package updateplatformsetting

import (
	"context"
	"encoding/json"
	"strings"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	adminevents "nantty/modules/admin/src/events"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/platformsetting"
	"nantty/modules/admin/src/generated/ent/platformsettingrevision"
	settingevents "nantty/modules/admin/src/modules/platformSettings/events"
	"nantty/modules/admin/src/modules/platformSettings/models"
	"nantty/modules/admin/src/modules/platformSettings/services"
	"nantty/modules/admin/src/repositories"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.PlatformSettingView, error) {
	definition, known := services.PlatformSettingDefinitions[command.Key]
	if !known {
		return models.PlatformSettingView{}, adminerrors.SettingNotFound
	}
	if !command.Actor.CanAny(append([]string{definition.WritePermission, "settings:edit"}, definition.ExtraWritePermissions...)...) {
		return models.PlatformSettingView{}, httpserver.ErrForbidden
	}
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 500 {
		return models.PlatformSettingView{}, adminerrors.Unprocessable("Give a reason of 5-500 characters.")
	}
	storageKey := services.StorageKeyFor(command.Key)
	var updated *ent.PlatformSetting
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := tx.PlatformSetting.Query().Where(platformsetting.Key(storageKey)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.SettingNotFound
		}
		if err != nil {
			return err
		}
		if current.Version != command.ExpectedVersion {
			return adminerrors.VersionConflict
		}
		value, err := handler.resolveValueInTransaction(ctx, tx, storageKey, definition, current, command)
		if err != nil {
			return err
		}
		canonical, err := services.PlatformSettingDefinitions[storageKey].Validate(value)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		if updated, err = current.Update().SetValue(canonical).SetVersion(current.Version + 1).SetUpdatedBy(command.Actor.Id).SetUpdatedAt(now).Save(ctx); err != nil {
			return err
		}
		if err := tx.PlatformSettingRevision.Create().SetKey(storageKey).SetVersion(updated.Version).SetValue(canonical).SetReason(reason).SetActor(command.Actor.Id).Exec(ctx); err != nil {
			return err
		}
		if err := adminevents.EnqueueOutboxEventInTransaction(ctx, tx, "platformSetting.changed", storageKey, now,
			settingevents.PlatformSettingChangedEventData{Key: storageKey, Version: updated.Version, ChangedBy: command.Actor.Id}); err != nil {
			return err
		}
		action := "platform_setting.changed"
		if command.RestoreVersion > 0 {
			action = "platform_setting.restored"
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: command.Actor.Id, ActorRole: command.Actor.Role, Action: action, SubjectType: "platform_setting", SubjectId: storageKey, SubjectLabel: command.Key,
			Before: current.Value, After: canonical, Reason: reason, StepUpVerified: command.Actor.SteppedUp,
		})
	})
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	views, err := services.BuildSettingViews(ctx, handler.Container.Client, []*ent.PlatformSetting{updated})
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	return services.ProjectSettingView(command.Key, views[0])
}

func (handler Handler) resolveValueInTransaction(ctx context.Context, tx *ent.Tx, storageKey string, definition services.SettingDefinition, current *ent.PlatformSetting, command Command) (json.RawMessage, error) {
	if command.RestoreVersion > 0 {
		revision, err := tx.PlatformSettingRevision.Query().Where(platformsettingrevision.Key(storageKey), platformsettingrevision.Version(command.RestoreVersion)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil, adminerrors.VersionNotFound
		}
		if err != nil {
			return nil, err
		}
		return revision.Value, nil
	}
	if definition.Projection == nil {
		return command.Value, nil
	}
	projected, err := definition.Validate(command.Value)
	if err != nil {
		return nil, err
	}
	return definition.Projection.Merge(current.Value, projected)
}

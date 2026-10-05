package updateplatformsetting

import (
	"context"
	"encoding/json"
	"strings"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	adminevents "zudomart/modules/admin/src/events"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsetting"
	"zudomart/modules/admin/src/generated/ent/platformsettingrevision"
	settingevents "zudomart/modules/admin/src/modules/platformSettings/events"
	"zudomart/modules/admin/src/modules/platformSettings/models"
	"zudomart/modules/admin/src/modules/platformSettings/services"
	"zudomart/modules/admin/src/repositories"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
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
	var updated *ent.PlatformSetting
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		value, err := handler.resolveValueInTransaction(ctx, tx, command)
		if err != nil {
			return err
		}
		canonical, err := definition.Validate(value)
		if err != nil {
			return err
		}
		current, err := tx.PlatformSetting.Query().Where(platformsetting.Key(command.Key)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.SettingNotFound
		}
		if err != nil {
			return err
		}
		if current.Version != command.ExpectedVersion {
			return adminerrors.VersionConflict
		}
		now := handler.Container.Now()
		if updated, err = current.Update().SetValue(canonical).SetVersion(current.Version + 1).SetUpdatedBy(command.Actor.Id).SetUpdatedAt(now).Save(ctx); err != nil {
			return err
		}
		if err := tx.PlatformSettingRevision.Create().SetKey(command.Key).SetVersion(updated.Version).SetValue(canonical).SetReason(reason).SetActor(command.Actor.Id).Exec(ctx); err != nil {
			return err
		}
		if err := adminevents.EnqueueOutboxEventInTransaction(ctx, tx, "platformSetting.changed", command.Key, now,
			settingevents.PlatformSettingChangedEventData{Key: command.Key, Version: updated.Version, ChangedBy: command.Actor.Id}); err != nil {
			return err
		}
		action := "platform_setting.changed"
		if command.RestoreVersion > 0 {
			action = "platform_setting.restored"
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: command.Actor.Id, ActorRole: command.Actor.Role, Action: action, SubjectType: "platform_setting", SubjectId: command.Key, SubjectLabel: command.Key,
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
	return views[0], nil
}

func (handler Handler) resolveValueInTransaction(ctx context.Context, tx *ent.Tx, command Command) (json.RawMessage, error) {
	if command.RestoreVersion <= 0 {
		return command.Value, nil
	}
	revision, err := tx.PlatformSettingRevision.Query().Where(platformsettingrevision.Key(command.Key), platformsettingrevision.Version(command.RestoreVersion)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adminerrors.VersionNotFound
	}
	return revision.Value, err
}

package updateplatformsetting

import (
	"context"
	"strings"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	adminevents "zudomart/modules/admin/src/events"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsetting"
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
	canonical, err := definition.Validate(command.Value)
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	var updated *ent.PlatformSetting
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
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
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: command.Actor.Id, ActorRole: command.Actor.Role, Action: "platform_setting.changed", SubjectType: "platform_setting", SubjectId: command.Key,
			Before: current.Value, After: canonical, Reason: reason,
		})
	})
	if err != nil {
		return models.PlatformSettingView{}, err
	}
	return models.ConvertSettingToView(updated), nil
}

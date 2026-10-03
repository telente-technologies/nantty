package updatestaffsettings

import (
	"context"
	"strings"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsetting"
	getstaffsettings "zudomart/modules/admin/src/modules/staffAdmins/queries/getStaffSettings"
	"zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/repositories"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (getstaffsettings.Result, error) {
	next := getstaffsettings.Result{RequireSecondSuperadminApproval: command.RequireSecondSuperadminApproval}
	value := jsonencoding.MustMarshalJson(next)
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		acting, err := services.LoadActingStaffInTransaction(ctx, tx, command.Actor)
		if err != nil {
			return err
		}
		if err := acting.RequireSuperadmin(); err != nil {
			return err
		}
		current, err := tx.PlatformSetting.Query().Where(platformsetting.Key("staff.settings")).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		updated, err := current.Update().SetValue(value).SetVersion(current.Version + 1).SetUpdatedBy(acting.Account.ID.String()).SetUpdatedAt(handler.Container.Now()).Save(ctx)
		if err != nil {
			return err
		}
		reason := strings.TrimSpace(command.Reason)
		if err := tx.PlatformSettingRevision.Create().SetKey("staff.settings").SetVersion(updated.Version).SetValue(value).SetReason(reason).SetActor(acting.Account.ID.String()).Exec(ctx); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: acting.Account.ID.String(), ActorRole: string(acting.Account.Role), Action: "staff_settings.changed", SubjectType: "staff_settings", SubjectId: "staff.settings",
			Before: current.Value, After: value, Reason: reason, StepUpVerified: command.Actor.SteppedUp,
		})
	})
	return next, err
}

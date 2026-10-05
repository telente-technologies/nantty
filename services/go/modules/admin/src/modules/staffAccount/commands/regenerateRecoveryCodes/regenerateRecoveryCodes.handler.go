package regeneraterecoverycodes

import (
	"context"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/modules/staffAccount/models"
	"zudomart/modules/admin/src/modules/staffAccount/services"
	staffauthservices "zudomart/modules/admin/src/modules/staffAuth/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.RecoveryCodesResult, error) {
	var codes []string
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		_, staff, err := staffauthservices.StaffAuthService{Container: handler.Container}.LoadLiveSessionInTransaction(ctx, tx, command.Actor.Id, command.Actor.SessionId)
		if err != nil {
			return err
		}
		if staff.TotpConfirmedAt == nil {
			return adminerrors.MfaNotEnrolled
		}
		if codes, err = (staffauthservices.StaffAuthService{Container: handler.Container}).IssueRecoveryCodesInTransaction(ctx, tx, staff); err != nil {
			return err
		}
		return services.RecordOwnAccountChange(ctx, tx, command.Actor, staff, "admin.recovery_codes_regenerated", nil, map[string]any{"count": len(codes)})
	})
	return models.RecoveryCodesResult{RecoveryCodes: codes}, err
}

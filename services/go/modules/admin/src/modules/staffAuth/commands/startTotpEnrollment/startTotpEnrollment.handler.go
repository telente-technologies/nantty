package starttotpenrollment

import (
	"context"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffloginchallenge"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/modules/staffAuth/services"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
	"zudomart/modules/admin/src/utils/totp"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.TotpEnrollment, error) {
	var enrollment models.TotpEnrollment
	service := services.StaffAuthService{Container: handler.Container}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		challenge, err := tx.StaffLoginChallenge.Query().
			Where(staffloginchallenge.TokenHash(secrettokens.HashOpaqueTokenForStorage(command.ChallengeToken)), staffloginchallenge.PurposeEQ(staffloginchallenge.PurposeEnroll),
				staffloginchallenge.ConsumedAtIsNil(), staffloginchallenge.ExpiresAtGT(handler.Container.Now())).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return adminerrors.InvalidChallenge
		}
		if err != nil {
			return err
		}
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(challenge.StaffID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if staff.Status != staffaccount.StatusActive || staff.TotpConfirmedAt != nil {
			return adminerrors.InvalidChallenge
		}
		secret, reused := service.OpenPendingTotpSecret(staff)
		if !reused {
			fresh, sealed, err := service.SealNewTotpSecret()
			if err != nil {
				return err
			}
			if err := tx.StaffAccount.UpdateOneID(staff.ID).SetTotpSecretEncrypted(sealed).Exec(ctx); err != nil {
				return err
			}
			secret = fresh
		}
		enrollment = models.TotpEnrollment{
			Secret:     totp.EncodeSecretForAuthenticatorApps(secret),
			OtpauthUri: totp.BuildProvisioningUri(handler.Container.Settings.TotpIssuerLabel, staff.Email, secret),
		}
		return nil
	})
	return enrollment, err
}

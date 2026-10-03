package application

import (
	"context"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffloginchallenge"
	"zudomart/modules/admin/internal/totp"
)

type TotpEnrollment struct {
	Secret     string `json:"secret"`
	OtpauthUri string `json:"otpauthUri"`
}

func (application *AdminApplication) StartTotpEnrollmentForChallenge(ctx context.Context, challengeToken string) (TotpEnrollment, error) {
	var enrollment TotpEnrollment
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		challenge, err := tx.StaffLoginChallenge.Query().
			Where(staffloginchallenge.TokenHash(hashOpaqueTokenForStorage(challengeToken)), staffloginchallenge.PurposeEQ(staffloginchallenge.PurposeEnroll),
				staffloginchallenge.ConsumedAtIsNil(), staffloginchallenge.ExpiresAtGT(now)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidChallenge
		}
		if err != nil {
			return err
		}
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(challenge.StaffID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if staff.Status != staffaccount.StatusActive || staff.TotpConfirmedAt != nil {
			return errInvalidChallenge
		}
		secret, sealed, err := application.sealNewTotpSecret()
		if err != nil {
			return err
		}
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetTotpSecretEncrypted(sealed).Exec(ctx); err != nil {
			return err
		}
		enrollment = TotpEnrollment{
			Secret:     totp.EncodeSecretForAuthenticatorApps(secret),
			OtpauthUri: totp.BuildProvisioningUri(application.Settings.TotpIssuerLabel, staff.Email, secret),
		}
		return nil
	})
	return enrollment, err
}

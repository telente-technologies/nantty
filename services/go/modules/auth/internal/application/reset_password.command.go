package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
)

type ResetPasswordInput struct {
	OtpToken    string
	NewPassword string
}

func (application *AuthApplication) ResetPasswordWithVerifiedCode(ctx context.Context, input ResetPasswordInput) error {
	if err := AssertPasswordMeetsPolicy(input.NewPassword); err != nil {
		return err
	}
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		destination, err := consumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeResetVerified, input.OtpToken, application.Now)
		if err != nil {
			return err
		}
		existing, err := tx.Account.Query().Where(account.Email(destination), account.StatusEQ(account.StatusActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errDestinationNotProven
		}
		if err != nil {
			return err
		}
		return application.storeNewPasswordAndRevokeSessionsInTransaction(ctx, tx, existing, input.NewPassword, uuid.Nil, "reset")
	})
}

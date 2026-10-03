package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/account"
)

type ChangePasswordInput struct {
	AccountId       string
	SessionId       string
	CurrentPassword string
	NewPassword     string
}

func (application *AuthApplication) ChangePasswordKeepingCurrentSession(ctx context.Context, input ChangePasswordInput) error {
	accountId, accountErr := uuid.Parse(input.AccountId)
	sessionId, sessionErr := uuid.Parse(input.SessionId)
	if accountErr != nil || sessionErr != nil {
		return errInvalidCredentials
	}
	if err := AssertPasswordMeetsPolicy(input.NewPassword); err != nil {
		return err
	}
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.Account.Query().Where(account.ID(accountId), account.StatusEQ(account.StatusActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidCredentials
		}
		if err != nil {
			return err
		}
		if existing.PasswordHash != nil {
			matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(input.CurrentPassword, *existing.PasswordHash)
			if err != nil || !matches {
				return errCurrentPasswordIncorrect
			}
		}
		return application.storeNewPasswordAndRevokeSessionsInTransaction(ctx, tx, existing, input.NewPassword, sessionId, "change")
	})
}

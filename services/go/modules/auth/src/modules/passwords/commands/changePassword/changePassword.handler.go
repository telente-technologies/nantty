package changepassword

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/services"
	"zudomart/modules/auth/src/utils"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) error {
	accountId, accountErr := uuid.Parse(command.AccountId)
	sessionId, sessionErr := uuid.Parse(command.SessionId)
	if accountErr != nil || sessionErr != nil {
		return authErrors.ErrInvalidCredentials
	}
	if err := utils.AssertPasswordMeetsPolicy(command.NewPassword); err != nil {
		return err
	}
	return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.Account.Query().Where(account.ID(accountId), account.StatusEQ(account.StatusActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return authErrors.ErrInvalidCredentials
		}
		if err != nil {
			return err
		}
		if existing.PasswordHash != nil {
			matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(command.CurrentPassword, *existing.PasswordHash)
			if err != nil || !matches {
				return authErrors.ErrCurrentPasswordIncorrect
			}
		}
		return services.StoreNewPasswordAndRevokeSessionsInTransaction(ctx, application.Container, tx, existing, command.NewPassword, sessionId, "change")
	})
}

package resetpassword

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	"zudomart/modules/auth/src/services"
	"zudomart/modules/auth/src/utils"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) error {
	if err := utils.AssertPasswordMeetsPolicy(command.NewPassword); err != nil {
		return err
	}
	var changed *ent.Account
	err := application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		destination, err := services.ConsumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeResetVerified, command.OtpToken, application.Now)
		if err != nil {
			return err
		}
		existing, err := tx.Account.Query().Where(account.Email(destination), account.StatusEQ(account.StatusActive)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return authErrors.ErrDestinationNotProven
		}
		if err != nil {
			return err
		}
		changed = existing
		return services.StoreNewPasswordAndRevokeSessionsInTransaction(ctx, application.Container, tx, existing, command.NewPassword, uuid.Nil, "reset")
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, application.Container, changed.ID, changed.Username, "password.reset", map[string]any{"sessionsRevoked": "all"})
	}
	return err
}

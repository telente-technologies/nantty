package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/platform/identityports"
)

func AssertDeactivatedAccountMayReturn(ctx context.Context, accountId uuid.UUID) error {
	deletions, err := identityports.Default.DeletionGraceCanceller()
	if err != nil {
		return authErrors.ErrInvalidCredentials
	}
	executed, err := deletions.AccountDeletionExecuted(ctx, accountId)
	if err != nil {
		return err
	}
	if executed {
		return authErrors.ErrAccountDeleted
	}
	return nil
}

func ReactivateAccountInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time) error {
	if err := tx.Account.UpdateOneID(accountId).Where(account.StatusEQ(account.StatusDeactivated)).SetStatus(account.StatusActive).Exec(ctx); err != nil && !ent.IsNotFound(err) {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "accountStatus.changed", accountId.String(), now, events.AccountEnforcementEventData{AccountId: accountId.String(), Status: "active"})
}

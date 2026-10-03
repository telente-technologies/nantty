package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/session"
)

type PasswordChangedEventData struct {
	AccountId       string `json:"accountId"`
	SessionsRevoked int    `json:"sessionsRevoked"`
	Method          string `json:"method"`
}

func revokeActiveSessionsExceptInTransaction(ctx context.Context, tx *ent.Tx, accountId, keepSessionId uuid.UUID, reason session.RevokedReason, now time.Time) (int, error) {
	return tx.Session.Update().
		Where(session.AccountID(accountId), session.RevokedAtIsNil(), session.IDNEQ(keepSessionId)).
		SetRevokedAt(now).SetRevokedReason(reason).
		Save(ctx)
}

func (application *AuthApplication) storeNewPasswordAndRevokeSessionsInTransaction(ctx context.Context, tx *ent.Tx, existing *ent.Account, password string, keepSessionId uuid.UUID, method string) error {
	passwordHash, err := application.Passwords.HashPasswordWithArgon2id(password)
	if err != nil {
		return err
	}
	now := application.Now()
	if err := tx.Account.UpdateOneID(existing.ID).SetPasswordHash(passwordHash).Exec(ctx); err != nil {
		return err
	}
	revoked, err := revokeActiveSessionsExceptInTransaction(ctx, tx, existing.ID, keepSessionId, session.RevokedReasonPasswordChanged, now)
	if err != nil {
		return err
	}
	return enqueueOutboxEventInTransaction(ctx, tx, "account.passwordChanged", existing.ID.String(), now, PasswordChangedEventData{
		AccountId: existing.ID.String(), SessionsRevoked: revoked, Method: method,
	})
}

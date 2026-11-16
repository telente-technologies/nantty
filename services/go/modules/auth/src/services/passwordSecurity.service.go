package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/messengertrusteddevice"
	"nantty/modules/auth/src/generated/ent/session"
)

func RevokeActiveSessionsExceptInTransaction(ctx context.Context, tx *ent.Tx, accountId, keepSessionId uuid.UUID, reason session.RevokedReason, now time.Time) (int, error) {
	return tx.Session.Update().
		Where(session.AccountID(accountId), session.RevokedAtIsNil(), session.IDNEQ(keepSessionId)).
		SetRevokedAt(now).SetRevokedReason(reason).
		Save(ctx)
}

func StoreNewPasswordAndRevokeSessionsInTransaction(ctx context.Context, application *container.Container, tx *ent.Tx, existing *ent.Account, password string, keepSessionId uuid.UUID, method string) error {
	passwordHash, err := application.Passwords.HashPasswordWithArgon2id(password)
	if err != nil {
		return err
	}
	now := application.Now()
	if err := tx.Account.UpdateOneID(existing.ID).SetPasswordHash(passwordHash).SetMustChangePassword(false).Exec(ctx); err != nil {
		return err
	}
	if err := tx.MessengerTrustedDevice.Update().Where(
		messengertrusteddevice.AccountID(existing.ID), messengertrusteddevice.RevokedAtIsNil(),
	).SetRevokedAt(now).Exec(ctx); err != nil {
		return err
	}
	revoked, err := RevokeActiveSessionsExceptInTransaction(ctx, tx, existing.ID, keepSessionId, session.RevokedReasonPasswordChanged, now)
	if err != nil {
		return err
	}
	if err := EnqueueSessionsEndedInTransaction(ctx, tx, existing.ID, "*", revoked, now); err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.passwordChanged", existing.ID.String(), now, events.PasswordChangedEventData{
		AccountId: existing.ID.String(), SessionsRevoked: revoked, Method: method,
	})
}

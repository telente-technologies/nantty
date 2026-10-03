package revokesession

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/session"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) error {
	owner, ownerErr := uuid.Parse(command.AccountId)
	target, targetErr := uuid.Parse(command.SessionId)
	if ownerErr != nil || targetErr != nil {
		return authErrors.ErrSessionNotFound
	}
	return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		revoked, err := tx.Session.Update().Where(session.ID(target), session.AccountID(owner), session.RevokedAtIsNil()).
			SetRevokedAt(now).SetRevokedReason(session.RevokedReasonLogout).Save(ctx)
		if err != nil {
			return err
		}
		if revoked == 0 {
			return authErrors.ErrSessionNotFound
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "session.revoked", owner.String(), now, events.SessionRevokedEventData{
			AccountId: owner.String(), SessionId: target.String(), Reason: "logout",
		})
	})
}

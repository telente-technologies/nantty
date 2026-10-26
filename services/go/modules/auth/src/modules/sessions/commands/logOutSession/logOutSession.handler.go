package logoutsession

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/session"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) error {
	parsedAccountId, accountErr := uuid.Parse(command.AccountId)
	parsedSessionId, sessionErr := uuid.Parse(command.SessionId)
	if accountErr != nil || sessionErr != nil {
		return authErrors.ErrInvalidRefreshToken
	}
	return application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		revoked, err := tx.Session.Update().
			Where(session.ID(parsedSessionId), session.AccountID(parsedAccountId), session.RevokedAtIsNil()).
			SetRevokedAt(now).
			SetRevokedReason(session.RevokedReasonLogout).
			Save(ctx)
		if err != nil || revoked == 0 {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "session.revoked", parsedAccountId.String(), now, events.SessionRevokedEventData{
			AccountId: parsedAccountId.String(), SessionId: parsedSessionId.String(), Reason: "logout",
		})
	})
}

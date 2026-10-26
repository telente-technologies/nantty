package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
)

const SessionsEndedBySecurityReason = "security"

func EnqueueSessionsEndedInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, sessionId string, revoked int, now time.Time) error {
	if revoked == 0 {
		return nil
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "session.revoked", accountId.String(), now, events.SessionRevokedEventData{
		AccountId: accountId.String(), SessionId: sessionId, Reason: SessionsEndedBySecurityReason,
	})
}

package revokeothersessions

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/session"
	"nantty/modules/auth/src/services"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (int, error) {
	owner, ownerErr := uuid.Parse(command.AccountId)
	current, currentErr := uuid.Parse(command.CurrentSessionId)
	if ownerErr != nil || currentErr != nil {
		return 0, authErrors.ErrInvalidRefreshToken
	}
	var revoked int
	err := application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		now := application.Now()
		if revoked, err = services.RevokeActiveSessionsExceptInTransaction(ctx, tx, owner, current, session.RevokedReasonRevokeAll, now); err != nil || revoked == 0 {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "session.revoked", owner.String(), now, events.SessionRevokedEventData{
			AccountId: owner.String(), SessionId: "*", Reason: "revoke_all",
		})
	})
	if err == nil && revoked > 0 {
		username := ""
		if account, lookupErr := application.Client.Account.Get(ctx, owner); lookupErr == nil {
			username = account.Username
		}
		services.RecordAccountSecurityEvent(ctx, application.Container, owner, username, "session.revoked_all", map[string]any{"sessionsRevoked": revoked, "keptSessionId": current.String()})
	}
	return revoked, err
}

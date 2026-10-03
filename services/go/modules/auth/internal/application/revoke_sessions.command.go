package application

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/session"
	"zudomart/platform/httpserver"
)

type SessionRevokedEventData struct {
	AccountId string `json:"accountId"`
	SessionId string `json:"sessionId"`
	Reason    string `json:"reason"`
}

func (application *AuthApplication) RevokeOwnedSession(ctx context.Context, accountId, sessionId string) error {
	owner, ownerErr := uuid.Parse(accountId)
	target, targetErr := uuid.Parse(sessionId)
	if ownerErr != nil || targetErr != nil {
		return httpserver.NewApiError(http.StatusNotFound, "SESSION_NOT_FOUND", "That session was not found.")
	}
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		revoked, err := tx.Session.Update().Where(session.ID(target), session.AccountID(owner), session.RevokedAtIsNil()).
			SetRevokedAt(now).SetRevokedReason(session.RevokedReasonLogout).Save(ctx)
		if err != nil {
			return err
		}
		if revoked == 0 {
			return httpserver.NewApiError(http.StatusNotFound, "SESSION_NOT_FOUND", "That session was not found.")
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "session.revoked", owner.String(), now, SessionRevokedEventData{
			AccountId: owner.String(), SessionId: target.String(), Reason: "logout",
		})
	})
}

func (application *AuthApplication) RevokeAllSessionsExceptCurrent(ctx context.Context, accountId, currentSessionId string) (int, error) {
	owner, ownerErr := uuid.Parse(accountId)
	current, currentErr := uuid.Parse(currentSessionId)
	if ownerErr != nil || currentErr != nil {
		return 0, errInvalidRefreshToken
	}
	var revoked int
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		now := application.Now()
		if revoked, err = revokeActiveSessionsExceptInTransaction(ctx, tx, owner, current, session.RevokedReasonRevokeAll, now); err != nil || revoked == 0 {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "session.revoked", owner.String(), now, SessionRevokedEventData{
			AccountId: owner.String(), SessionId: "*", Reason: "revoke_all",
		})
	})
	return revoked, err
}

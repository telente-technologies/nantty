package refreshsessiontokens

import (
	"context"
	"time"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/generated/ent/refreshtoken"
	"nantty/modules/auth/src/generated/ent/session"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"

	"github.com/google/uuid"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (types.IssuedTokens, error) {
	var rejection error
	var owner *ent.Account
	var currentSession *ent.Session
	var nextRefreshToken string
	err := application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		presented, err := tx.RefreshToken.Query().
			Where(refreshtoken.TokenHash(utils.HashOpaqueTokenForStorage(command.RefreshToken))).
			ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			rejection = authErrors.ErrInvalidRefreshToken
			return nil
		}
		if err != nil {
			return err
		}
		currentSession, err = tx.Session.Query().Where(session.ID(presented.SessionID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if presented.UsedAt != nil {
			rejection = authErrors.ErrRefreshTokenReused
			return application.revokeSessionAfterRefreshTokenReuseInTransaction(ctx, tx, currentSession, now)
		}
		if !isSessionUsable(currentSession, presented, now, application.Settings.SessionMaximumLifetime) {
			rejection = authErrors.ErrInvalidRefreshToken
			return nil
		}
		owner, err = tx.Account.Query().Where(account.ID(currentSession.AccountID), account.StatusIn(account.StatusActive, account.StatusSuspended)).Only(ctx)
		if ent.IsNotFound(err) {
			rejection = authErrors.ErrInvalidRefreshToken
			return nil
		}
		if err != nil {
			return err
		}
		nextExpiry := earliestOf(now.Add(application.Settings.RefreshTokenTimeToLive), currentSession.CreatedAt.Add(application.Settings.SessionMaximumLifetime))
		var nextTokenId uuid.UUID
		if nextRefreshToken, nextTokenId, err = services.CreateRefreshTokenInTransaction(ctx, application.Container, tx, currentSession.ID, nextExpiry); err != nil {
			return err
		}
		if err := presented.Update().SetUsedAt(now).SetReplacedByID(nextTokenId).Exec(ctx); err != nil {
			return err
		}
		return currentSession.Update().SetLastUsedAt(now).SetExpiresAt(nextExpiry).Exec(ctx)
	})
	if err != nil {
		return types.IssuedTokens{}, err
	}
	if rejection != nil {
		return types.IssuedTokens{}, rejection
	}
	return services.SignAccessTokenAndBuildIssuedTokens(application.Container, owner, currentSession.ID, nextRefreshToken)
}

func (application Handler) revokeSessionAfterRefreshTokenReuseInTransaction(ctx context.Context, tx *ent.Tx, reused *ent.Session, now time.Time) error {
	if reused.RevokedAt != nil {
		return nil
	}
	if err := reused.Update().SetRevokedAt(now).SetRevokedReason(session.RevokedReasonRefreshTokenReuse).Exec(ctx); err != nil {
		return err
	}
	application.Logger.WarnContext(ctx, "refresh token reuse detected; session revoked", "sessionId", reused.ID.String())
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "session.refreshTokenReuseDetected", reused.AccountID.String(), now, events.RefreshTokenReuseDetectedEventData{
		AccountId: reused.AccountID.String(), SessionId: reused.ID.String(),
	})
}

func isSessionUsable(current *ent.Session, presented *ent.RefreshToken, now time.Time, maximumLifetime time.Duration) bool {
	return current.RevokedAt == nil &&
		current.ExpiresAt.After(now) &&
		presented.ExpiresAt.After(now) &&
		current.CreatedAt.Add(maximumLifetime).After(now)
}

func earliestOf(first, second time.Time) time.Time {
	if first.Before(second) {
		return first
	}
	return second
}

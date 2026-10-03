package application

import (
	"context"
	"time"

	"zudomart/modules/auth/internal/credentials"
	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/account"
	"zudomart/modules/auth/internal/ent/refreshtoken"
	"zudomart/modules/auth/internal/ent/session"
)

func (application *AuthApplication) RotateRefreshTokenAndDetectReuse(ctx context.Context, presentedRefreshToken string) (IssuedTokens, error) {
	var rejection error
	var owner *ent.Account
	var currentSession *ent.Session
	var nextRefreshToken string
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		presented, err := tx.RefreshToken.Query().
			Where(refreshtoken.TokenHash(credentials.HashOpaqueTokenForStorage(presentedRefreshToken))).
			ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			rejection = errInvalidRefreshToken
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
			rejection = errRefreshTokenReused
			return application.revokeSessionAfterRefreshTokenReuseInTransaction(ctx, tx, currentSession, now)
		}
		if !isSessionUsable(currentSession, presented, now, application.Settings.SessionMaximumLifetime) {
			rejection = errInvalidRefreshToken
			return nil
		}
		owner, err = tx.Account.Query().Where(account.ID(currentSession.AccountID), account.StatusEQ(account.StatusActive)).Only(ctx)
		if ent.IsNotFound(err) {
			rejection = errInvalidRefreshToken
			return nil
		}
		if err != nil {
			return err
		}
		nextExpiry := earliestOf(now.Add(application.Settings.RefreshTokenTimeToLive), currentSession.CreatedAt.Add(application.Settings.SessionMaximumLifetime))
		var nextTokenId = presented.ID
		if nextRefreshToken, nextTokenId, err = application.createRefreshTokenInTransaction(ctx, tx, currentSession.ID, nextExpiry); err != nil {
			return err
		}
		if err := presented.Update().SetUsedAt(now).SetReplacedByID(nextTokenId).Exec(ctx); err != nil {
			return err
		}
		return currentSession.Update().SetLastUsedAt(now).SetExpiresAt(nextExpiry).Exec(ctx)
	})
	if err != nil {
		return IssuedTokens{}, err
	}
	if rejection != nil {
		return IssuedTokens{}, rejection
	}
	return application.signAccessTokenAndBuildIssuedTokens(owner, currentSession.ID, nextRefreshToken)
}

func (application *AuthApplication) revokeSessionAfterRefreshTokenReuseInTransaction(ctx context.Context, tx *ent.Tx, reused *ent.Session, now time.Time) error {
	if reused.RevokedAt != nil {
		return nil
	}
	if err := reused.Update().SetRevokedAt(now).SetRevokedReason(session.RevokedReasonRefreshTokenReuse).Exec(ctx); err != nil {
		return err
	}
	application.Logger.WarnContext(ctx, "refresh token reuse detected; session revoked", "sessionId", reused.ID.String())
	return enqueueOutboxEventInTransaction(ctx, tx, "session.refreshTokenReuseDetected", reused.AccountID.String(), now, RefreshTokenReuseDetectedEventData{
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

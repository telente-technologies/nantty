package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/internal/credentials"
	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/signingkeys"
)

type startedSession struct {
	sessionId    uuid.UUID
	refreshToken string
}

func (application *AuthApplication) startSessionWithFirstRefreshTokenInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, client ClientDetails) (startedSession, error) {
	now := application.Now()
	session, err := tx.Session.Create().
		SetAccountID(accountId).
		SetUserAgent(truncateToLength(client.UserAgent, 255)).
		SetIPAddress(truncateToLength(client.IpAddress, 64)).
		SetLastUsedAt(now).
		SetExpiresAt(now.Add(application.Settings.RefreshTokenTimeToLive)).
		Save(ctx)
	if err != nil {
		return startedSession{}, err
	}
	refreshToken, _, err := application.createRefreshTokenInTransaction(ctx, tx, session.ID, now.Add(application.Settings.RefreshTokenTimeToLive))
	if err != nil {
		return startedSession{}, err
	}
	return startedSession{sessionId: session.ID, refreshToken: refreshToken}, nil
}

func (application *AuthApplication) createRefreshTokenInTransaction(ctx context.Context, tx *ent.Tx, sessionId uuid.UUID, expiresAt time.Time) (string, uuid.UUID, error) {
	rawToken, err := credentials.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return "", uuid.Nil, err
	}
	stored, err := tx.RefreshToken.Create().
		SetSessionID(sessionId).
		SetTokenHash(credentials.HashOpaqueTokenForStorage(rawToken)).
		SetExpiresAt(expiresAt).
		Save(ctx)
	if err != nil {
		return "", uuid.Nil, err
	}
	return rawToken, stored.ID, nil
}

func (application *AuthApplication) signAccessTokenAndBuildIssuedTokens(account *ent.Account, sessionId uuid.UUID, refreshToken string) (IssuedTokens, error) {
	accessToken, err := application.TokenIssuer.SignAccessTokenWithActiveKey(signingkeys.AccessTokenClaims{
		AccountId: account.ID.String(),
		SessionId: sessionId.String(),
		Roles:     account.Roles,
	})
	if err != nil {
		return IssuedTokens{}, err
	}
	return IssuedTokens{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: application.TokenIssuer.TimeToLiveInSeconds(), TokenType: "Bearer"}, nil
}

func truncateToLength(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}

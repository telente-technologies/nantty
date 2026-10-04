package services

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/generated/ent"
	entaccount "zudomart/modules/auth/src/generated/ent/account"
	signingkeys "zudomart/modules/auth/src/modules/signingKeys/services"
	"zudomart/modules/auth/src/types"
	"zudomart/modules/auth/src/utils"
)

type StartedSession struct {
	SessionId    uuid.UUID
	RefreshToken string
}

func StartSessionWithFirstRefreshTokenInTransaction(ctx context.Context, application *container.Container, tx *ent.Tx, accountId uuid.UUID, client types.ClientDetails) (StartedSession, error) {
	now := application.Now()
	create := tx.Session.Create().
		SetAccountID(accountId).
		SetUserAgent(utils.TruncateToLength(client.UserAgent, 255)).
		SetIPAddress(utils.TruncateToLength(client.IpAddress, 64)).
		SetLastUsedAt(now).
		SetExpiresAt(now.Add(application.Settings.RefreshTokenTimeToLive))
	if client.DeviceId != "" {
		create.SetDeviceHash(HashBlockedIdentifier(application.Settings.OneTimeCodePepper, "device", client.DeviceId))
	}
	session, err := create.Save(ctx)
	if err != nil {
		return StartedSession{}, err
	}
	refreshToken, _, err := CreateRefreshTokenInTransaction(ctx, application, tx, session.ID, now.Add(application.Settings.RefreshTokenTimeToLive))
	if err != nil {
		return StartedSession{}, err
	}
	return StartedSession{SessionId: session.ID, RefreshToken: refreshToken}, nil
}

func CreateRefreshTokenInTransaction(ctx context.Context, application *container.Container, tx *ent.Tx, sessionId uuid.UUID, expiresAt time.Time) (string, uuid.UUID, error) {
	rawToken, err := utils.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return "", uuid.Nil, err
	}
	stored, err := tx.RefreshToken.Create().
		SetSessionID(sessionId).
		SetTokenHash(utils.HashOpaqueTokenForStorage(rawToken)).
		SetExpiresAt(expiresAt).
		Save(ctx)
	if err != nil {
		return "", uuid.Nil, err
	}
	return rawToken, stored.ID, nil
}

func SignAccessTokenAndBuildIssuedTokens(application *container.Container, account *ent.Account, sessionId uuid.UUID, refreshToken string) (types.IssuedTokens, error) {
	accessToken, err := application.TokenIssuer.SignAccessTokenWithActiveKey(signingkeys.AccessTokenClaims{
		AccountId:  account.ID.String(),
		SessionId:  sessionId.String(),
		Roles:      rolesForAccessToken(account),
		AgeBracket: utils.AgeBracketFromBirthday(account.Birthday, application.Now()),
	})
	if err != nil {
		return types.IssuedTokens{}, err
	}
	return types.IssuedTokens{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: application.TokenIssuer.TimeToLiveInSeconds(), TokenType: "Bearer"}, nil
}

func rolesForAccessToken(account *ent.Account) []string {
	if account.Status != entaccount.StatusSuspended {
		return account.Roles
	}
	return append(slices.Clone(account.Roles), "suspended")
}

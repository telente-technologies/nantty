package services

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	"nantty/modules/auth/src/generated/ent"
	entaccount "nantty/modules/auth/src/generated/ent/account"
	signingkeys "nantty/modules/auth/src/modules/signingKeys/services"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"
)

type StartedSession struct {
	SessionId    uuid.UUID
	RefreshToken string
}

func StartSessionWithFirstRefreshTokenInTransaction(ctx context.Context, application *container.Container, tx *ent.Tx, accountId uuid.UUID, client types.ClientDetails) (StartedSession, error) {
	deviceHash := ""
	if client.DeviceId != "" {
		deviceHash = HashBlockedIdentifier(application.Settings.OneTimeCodePepper, "device", client.DeviceId)
	}
	return StartSessionWithDeviceHashInTransaction(ctx, application, tx, accountId, client, deviceHash)
}

func StartSessionWithDeviceHashInTransaction(ctx context.Context, application *container.Container, tx *ent.Tx, accountId uuid.UUID, client types.ClientDetails, deviceHash string) (StartedSession, error) {
	now := application.Now()
	create := tx.Session.Create().
		SetAccountID(accountId).
		SetUserAgent(utils.TruncateToLength(client.UserAgent, 255)).
		SetIPAddress(utils.TruncateToLength(client.IpAddress, 64)).
		SetLastUsedAt(now).
		SetExpiresAt(now.Add(application.Settings.RefreshTokenTimeToLive))
	if deviceHash != "" {
		create.SetDeviceHash(deviceHash)
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

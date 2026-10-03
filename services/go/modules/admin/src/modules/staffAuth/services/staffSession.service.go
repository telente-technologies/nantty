package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/types"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

const AbsoluteSessionLifetime = 7 * 24 * time.Hour

type StaffAuthService struct {
	Container *container.Container
}

func ClaimsForStaff(staff *ent.StaffAccount, sessionId uuid.UUID) identityports.StaffTokenClaims {
	return identityports.StaffTokenClaims{StaffId: staff.ID.String(), SessionId: sessionId.String(), Roles: staffauth.RolesClaimForStaff(string(staff.Role), staff.Permissions)}
}

func (service StaffAuthService) StartSessionInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount) (uuid.UUID, string, error) {
	refreshToken, err := secrettokens.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return uuid.Nil, "", err
	}
	now := service.Container.Now()
	client := types.ClientDetailsFromContext(ctx)
	created, err := tx.StaffSession.Create().
		SetStaffID(staff.ID).SetIPAddress(types.TruncateToLength(client.IpAddress, 64)).SetUserAgent(types.TruncateToLength(client.UserAgent, 255)).
		SetRefreshHash(secrettokens.HashOpaqueTokenForStorage(refreshToken)).SetLastUsedAt(now).SetExpiresAt(now.Add(service.Container.Settings.StaffRefreshTokenTtl)).
		Save(ctx)
	return created.ID, refreshToken, err
}

func (service StaffAuthService) BuildSessionResult(staff *ent.StaffAccount, sessionId uuid.UUID, refreshToken string) (models.StaffSessionResult, error) {
	tokens, err := service.Container.Tokens()
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	accessToken, expiresIn, err := tokens.SignStaffAccessToken(ClaimsForStaff(staff, sessionId))
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	return models.StaffSessionResult{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: expiresIn, TokenType: "Bearer", Staff: types.ConvertStaffToView(staff)}, nil
}

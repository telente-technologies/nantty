package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffsession"
	staffadminservices "zudomart/modules/admin/src/modules/staffAdmins/services"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/types"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

const (
	AbsoluteSessionLifetime = 12 * time.Hour
	IdleSessionLifetime     = 30 * time.Minute
)

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

func (service StaffAuthService) BuildSessionResult(ctx context.Context, staff *ent.StaffAccount, sessionId uuid.UUID, refreshToken string) (models.StaffSessionResult, error) {
	tokens, err := service.Container.Tokens()
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	view, err := staffadminservices.BuildSingleStaffView(ctx, service.Container, staff)
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	displayName := view.Name
	if displayName == "" {
		displayName = staff.Email
	}
	claims := ClaimsForStaff(staff, sessionId)
	claims.Roles = staffauth.RolesClaimForNamedStaff(displayName, string(staff.Role), staffauth.ExpandPermissionsWithAliases(view.Permissions))
	if staff.Role == staffaccount.RoleSuperadmin {
		claims.Roles = staffauth.RolesClaimForNamedStaff(displayName, string(staff.Role), nil)
	}
	accessToken, expiresIn, err := tokens.SignStaffAccessToken(claims)
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	return models.StaffSessionResult{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: expiresIn, TokenType: "Bearer", Staff: view}, nil
}

func (service StaffAuthService) LoadLiveSessionInTransaction(ctx context.Context, tx *ent.Tx, staffId, sessionId string) (*ent.StaffSession, *ent.StaffAccount, error) {
	staffUuid, staffErr := uuid.Parse(staffId)
	sessionUuid, sessionErr := uuid.Parse(sessionId)
	if staffErr != nil || sessionErr != nil {
		return nil, nil, adminerrors.InvalidRefreshToken
	}
	session, err := tx.StaffSession.Query().
		Where(staffsession.ID(sessionUuid), staffsession.StaffID(staffUuid), staffsession.RevokedAtIsNil(), staffsession.ExpiresAtGT(service.Container.Now())).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil, adminerrors.InvalidRefreshToken
	}
	if err != nil {
		return nil, nil, err
	}
	staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(staffUuid), staffaccount.StatusEQ(staffaccount.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil, adminerrors.InvalidRefreshToken
	}
	return session, staff, err
}

package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

const absoluteSessionLifetime = 7 * 24 * time.Hour

type StaffView struct {
	Id          string   `json:"id"`
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	Status      string   `json:"status"`
	MfaEnrolled bool     `json:"mfaEnrolled"`
	CreatedAt   string   `json:"createdAt"`
}

type StaffSessionResult struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	ExpiresIn    int       `json:"expiresIn"`
	TokenType    string    `json:"tokenType"`
	Staff        StaffView `json:"staff"`
}

func ConvertStaffToView(staff *ent.StaffAccount) StaffView {
	permissions := staff.Permissions
	if permissions == nil {
		permissions = []string{}
	}
	return StaffView{
		Id: staff.ID.String(), Email: staff.Email, DisplayName: staff.DisplayName, Role: string(staff.Role), Permissions: permissions,
		Status: string(staff.Status), MfaEnrolled: staff.TotpConfirmedAt != nil, CreatedAt: staff.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func (application *AdminApplication) startSessionInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount) (uuid.UUID, string, error) {
	refreshToken, err := generateOpaqueUrlSafeToken()
	if err != nil {
		return uuid.Nil, "", err
	}
	now := application.Now()
	client := clientDetailsFromContext(ctx)
	created, err := tx.StaffSession.Create().
		SetStaffID(staff.ID).SetIPAddress(truncateToLength(client.IpAddress, 64)).SetUserAgent(truncateToLength(client.UserAgent, 255)).
		SetRefreshHash(hashOpaqueTokenForStorage(refreshToken)).SetLastUsedAt(now).SetExpiresAt(now.Add(application.Settings.StaffRefreshTokenTtl)).
		Save(ctx)
	return created.ID, refreshToken, err
}

func (application *AdminApplication) buildSessionResult(staff *ent.StaffAccount, sessionId uuid.UUID, refreshToken string) (StaffSessionResult, error) {
	tokens, err := application.Tokens()
	if err != nil {
		return StaffSessionResult{}, err
	}
	accessToken, expiresIn, err := tokens.SignStaffAccessToken(claimsForStaff(staff, sessionId))
	if err != nil {
		return StaffSessionResult{}, err
	}
	return StaffSessionResult{AccessToken: accessToken, RefreshToken: refreshToken, ExpiresIn: expiresIn, TokenType: "Bearer", Staff: ConvertStaffToView(staff)}, nil
}

func claimsForStaff(staff *ent.StaffAccount, sessionId uuid.UUID) identityports.StaffTokenClaims {
	return identityports.StaffTokenClaims{StaffId: staff.ID.String(), SessionId: sessionId.String(), Roles: staffauth.RolesClaimForStaff(string(staff.Role), staff.Permissions)}
}

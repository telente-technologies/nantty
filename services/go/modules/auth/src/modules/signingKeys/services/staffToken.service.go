package services

import (
	"context"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"

	"nantty/platform/identityports"
	"nantty/platform/staffauth"
)

type StaffTokenService struct {
	Issuer     *AccessTokenIssuer
	Keys       *SigningKeyService
	TimeToLive time.Duration
}

func (service StaffTokenService) SignStaffAccessToken(claims identityports.StaffTokenClaims) (string, int, error) {
	token, err := service.Issuer.SignTokenForAudience(staffauth.AccessAudience, service.TimeToLive, toAccessTokenClaims(claims))
	return token, int(service.TimeToLive.Seconds()), err
}

func (service StaffTokenService) SignStaffStepUpToken(claims identityports.StaffTokenClaims, timeToLive time.Duration) (string, error) {
	return service.Issuer.SignTokenForAudience(staffauth.StepUpAudience, timeToLive, toAccessTokenClaims(claims))
}

func (service StaffTokenService) PublishedKeySet(ctx context.Context) (jwk.Set, error) {
	return service.Keys.PublishedPublicKeySet(ctx)
}

func (service StaffTokenService) StaffTokenIssuer() string { return service.Issuer.Issuer() }

func toAccessTokenClaims(claims identityports.StaffTokenClaims) AccessTokenClaims {
	return AccessTokenClaims{AccountId: claims.StaffId, SessionId: claims.SessionId, Roles: claims.Roles}
}

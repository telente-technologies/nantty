package application

import (
	"context"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"

	"zudomart/modules/auth/internal/signingkeys"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

type StaffTokenService struct {
	Issuer     *signingkeys.AccessTokenIssuer
	Keys       *signingkeys.SigningKeyService
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

func toAccessTokenClaims(claims identityports.StaffTokenClaims) signingkeys.AccessTokenClaims {
	return signingkeys.AccessTokenClaims{AccountId: claims.StaffId, SessionId: claims.SessionId, Roles: claims.Roles}
}

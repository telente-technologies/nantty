package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"zudomart/modules/auth/internal/config"
	"zudomart/modules/auth/internal/credentials"
	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/signingkeys"
	"zudomart/modules/auth/internal/socialidentity"
	"zudomart/platform/httpserver"
)

type Dependencies struct {
	Client      *ent.Client
	Settings    config.AuthSettings
	Passwords   *credentials.PasswordHasher
	TokenIssuer *signingkeys.AccessTokenIssuer
	Delivery    OneTimeCodeDelivery
	Social      *socialidentity.IdentityTokenVerifier
	Logger      *slog.Logger
	Now         func() time.Time
}

type AuthApplication struct {
	Dependencies
}

func NewAuthApplication(dependencies Dependencies) *AuthApplication {
	if dependencies.Now == nil {
		dependencies.Now = time.Now
	}
	return &AuthApplication{Dependencies: dependencies}
}

type ClientDetails struct {
	UserAgent string
	IpAddress string
}

type IssuedTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ExpiresIn    int    `json:"expiresIn"`
	TokenType    string `json:"tokenType"`
}

type AuthenticationResult struct {
	Tokens    IssuedTokens
	Account   *ent.Account
	IsNewUser bool
}

const eventSource = "zudomart.auth"

var (
	errInvalidCredentials        = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_CREDENTIALS", "The email, username or password is incorrect.")
	errInvalidRefreshToken       = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", "Your session has ended. Sign in again.")
	errRefreshTokenReused        = httpserver.NewApiError(http.StatusUnauthorized, "REFRESH_TOKEN_REUSED", "Your session has ended. Sign in again.")
	errInvalidOneTimeCode        = httpserver.NewApiError(http.StatusBadRequest, "INVALID_CODE", "The code is invalid or has expired.")
	errTooManyCodeAttempts       = httpserver.NewApiError(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new code.")
	errDestinationNotProven      = httpserver.NewApiError(http.StatusBadRequest, "DESTINATION_NOT_VERIFIED", "Verify your email address first.")
	errEmailAlreadyInUse         = httpserver.NewApiError(http.StatusConflict, "EMAIL_TAKEN", "An account with this email already exists.")
	errUsernameAlreadyInUse      = httpserver.NewApiError(http.StatusConflict, "USERNAME_TAKEN", "That username is taken.")
	errCurrentPasswordIncorrect  = httpserver.NewApiError(http.StatusUnauthorized, "CURRENT_PASSWORD_INCORRECT", "Your current password is incorrect.")
	errSocialSignInNotConfigured = httpserver.NewApiError(http.StatusServiceUnavailable, "SOCIAL_SIGN_IN_NOT_CONFIGURED", "This sign-in method is not available right now.")
	errInvalidIdentityToken      = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_IDENTITY_TOKEN", "We could not verify your sign-in. Try again.")
	errSocialEmailNotVerified    = httpserver.NewApiError(http.StatusUnprocessableEntity, "SOCIAL_EMAIL_NOT_VERIFIED", "The provider has not verified your email address.")
)

func unprocessable(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "UNPROCESSABLE", message)
}

func (application *AuthApplication) runInTransaction(ctx context.Context, work func(tx *ent.Tx) error) error {
	tx, err := application.Client.Tx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	if err := work(tx); err != nil {
		return errors.Join(err, tx.Rollback())
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

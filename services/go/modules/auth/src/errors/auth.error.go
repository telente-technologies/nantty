package errors

import (
	"net/http"

	"zudomart/platform/httpserver"
)

var (
	ErrInvalidCredentials        = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_CREDENTIALS", "The email, username or password is incorrect.")
	ErrInvalidRefreshToken       = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", "Your session has ended. Sign in again.")
	ErrRefreshTokenReused        = httpserver.NewApiError(http.StatusUnauthorized, "REFRESH_TOKEN_REUSED", "Your session has ended. Sign in again.")
	ErrInvalidOneTimeCode        = httpserver.NewApiError(http.StatusBadRequest, "INVALID_CODE", "The code is invalid or has expired.")
	ErrTooManyCodeAttempts       = httpserver.NewApiError(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new code.")
	ErrDestinationNotProven      = httpserver.NewApiError(http.StatusBadRequest, "DESTINATION_NOT_VERIFIED", "Verify your email address first.")
	ErrEmailAlreadyInUse         = httpserver.NewApiError(http.StatusConflict, "EMAIL_TAKEN", "An account with this email already exists.")
	ErrUsernameAlreadyInUse      = httpserver.NewApiError(http.StatusConflict, "USERNAME_TAKEN", "That username is taken.")
	ErrCurrentPasswordIncorrect  = httpserver.NewApiError(http.StatusUnauthorized, "CURRENT_PASSWORD_INCORRECT", "Your current password is incorrect.")
	ErrSocialSignInNotConfigured = httpserver.NewApiError(http.StatusServiceUnavailable, "SOCIAL_SIGN_IN_NOT_CONFIGURED", "This sign-in method is not available right now.")
	ErrInvalidIdentityToken      = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_IDENTITY_TOKEN", "We could not verify your sign-in. Try again.")
	ErrSocialEmailNotVerified    = httpserver.NewApiError(http.StatusUnprocessableEntity, "SOCIAL_EMAIL_NOT_VERIFIED", "The provider has not verified your email address.")
	ErrSignupBlocked             = httpserver.NewApiError(http.StatusForbidden, "SIGNUP_BLOCKED", "We cannot create an account with these details.")
	ErrAccountBanned             = httpserver.NewApiError(http.StatusForbidden, "ACCOUNT_BANNED", "This account has been banned.")
	ErrAccountSuspended          = httpserver.NewApiError(http.StatusForbidden, "ACCOUNT_SUSPENDED", "This account has been suspended.")
	ErrAccountDeleted            = httpserver.NewApiError(http.StatusForbidden, "ACCOUNT_DELETED", "This account was deleted. Create a new account to come back.")
	ErrSessionNotFound           = httpserver.NewApiError(http.StatusNotFound, "SESSION_NOT_FOUND", "That session was not found.")
)

func Unprocessable(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "UNPROCESSABLE", message)
}

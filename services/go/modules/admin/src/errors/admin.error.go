package errors

import (
	"net/http"

	"nantty/platform/httpserver"
)

var (
	InvalidCredentials  = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_CREDENTIALS", "The email or password is incorrect.")
	InvalidChallenge    = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_CHALLENGE", "Sign in again.")
	InvalidMfaCode      = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_MFA_CODE", "The code is invalid or has expired.")
	TooManyMfaAttempts  = httpserver.NewApiError(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Sign in again.")
	InvalidRefreshToken = httpserver.NewApiError(http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", "Your session has ended. Sign in again.")
	RefreshTokenReused  = httpserver.NewApiError(http.StatusUnauthorized, "REFRESH_TOKEN_REUSED", "Your session has ended. Sign in again.")
	InvalidInvitation   = httpserver.NewApiError(http.StatusBadRequest, "INVALID_INVITATION", "This invitation is invalid or has expired.")
	EmailAlreadyInUse   = httpserver.NewApiError(http.StatusConflict, "ADMIN_EXISTS", "A staff account with this email already exists.")
	StaffNotFound       = httpserver.NewApiError(http.StatusNotFound, "STAFF_NOT_FOUND", "That staff account was not found.")
	SuperadminRequired  = httpserver.NewApiError(http.StatusForbidden, "SUPERADMIN_REQUIRED", "Only a superadmin can do that.")
	MfaNotEnrolled      = httpserver.NewApiError(http.StatusConflict, "MFA_NOT_ENROLLED", "Set up multi-factor authentication first.")
	SettingNotFound     = httpserver.NewApiError(http.StatusNotFound, "SETTING_NOT_FOUND", "That setting does not exist.")
	VersionNotFound     = httpserver.NewApiError(http.StatusNotFound, "VERSION_NOT_FOUND", "That version of the setting does not exist.")
	VersionConflict     = httpserver.NewApiError(http.StatusConflict, "VERSION_CONFLICT", "This setting changed since you loaded it. Reload and try again.")
	TooManyRequests     = httpserver.NewApiError(http.StatusTooManyRequests, "RATE_LIMITED", "Too many attempts. Try again shortly.")
	IpNotAllowed        = httpserver.NewApiError(http.StatusForbidden, "IP_NOT_ALLOWED", "The admin console cannot be used from this network.")
	PasskeysUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "PASSKEYS_UNAVAILABLE", "Passkeys are not available right now.")
	NoPasskeys          = httpserver.NewApiError(http.StatusNotFound, "NO_PASSKEYS", "No passkeys are registered for this admin.")
	PasskeyNotFound     = httpserver.NewApiError(http.StatusNotFound, "PASSKEY_NOT_FOUND", "That passkey was not found.")
	PasskeyExpired      = httpserver.NewApiError(http.StatusConflict, "PASSKEY_CHALLENGE_EXPIRED", "Start adding the passkey again.")
	PasskeyNotVerified  = httpserver.NewApiError(http.StatusBadRequest, "PASSKEY_NOT_VERIFIED", "The passkey could not be verified.")
	PasskeyExists       = httpserver.NewApiError(http.StatusConflict, "PASSKEY_EXISTS", "This passkey is already registered.")
	SessionNotFound     = httpserver.NewApiError(http.StatusNotFound, "SESSION_NOT_FOUND", "That session was not found.")
)

func ValidationFailedFor(path, message string) *httpserver.ApiError {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func Conflict(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusConflict, code, message)
}

func Forbidden(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusForbidden, code, message)
}

func Unprocessable(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "UNPROCESSABLE", message)
}

func FirstError(err error, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}

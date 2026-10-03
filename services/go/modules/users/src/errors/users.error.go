package errors

import (
	"net/http"

	"zudomart/platform/httpserver"
)

var (
	ErrProfileNotFound      = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "That profile was not found.")
	ErrAccountUnavailable   = httpserver.NewApiError(http.StatusUnauthorized, "UNAUTHORIZED", "Sign in to continue.")
	ErrUsernameTaken        = httpserver.NewApiError(http.StatusConflict, "USERNAME_TAKEN", "That username is taken.")
	ErrHandleTaken          = httpserver.NewApiError(http.StatusConflict, "HANDLE_TAKEN", "That handle isn't available.")
	ErrActingProfileInvalid = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "That profile was not found.")
	ErrAlreadyHasCreator    = httpserver.NewApiError(http.StatusConflict, "CREATOR_PROFILE_EXISTS", "You already have a creator profile.")
)

func Unprocessable(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "UNPROCESSABLE", message)
}

func UnprocessableWithCode(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusUnprocessableEntity, code, message)
}

func TooManyRequestsWithCode(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusTooManyRequests, code, message)
}

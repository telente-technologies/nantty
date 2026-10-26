package errors

import (
	"net/http"

	"nantty/platform/httpserver"
)

var (
	ErrProfileNotFound          = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "That profile was not found.")
	ErrAccountUnavailable       = httpserver.NewApiError(http.StatusUnauthorized, "UNAUTHORIZED", "Sign in to continue.")
	ErrUsernameTaken            = httpserver.NewApiError(http.StatusConflict, "USERNAME_TAKEN", "That username is taken.")
	ErrHandleTaken              = httpserver.NewApiError(http.StatusConflict, "HANDLE_TAKEN", "That handle isn't available.")
	ErrActingProfileInvalid     = httpserver.NewApiError(http.StatusNotFound, "PROFILE_NOT_FOUND", "That profile was not found.")
	ErrCreatorApplicationExists = httpserver.NewApiError(http.StatusConflict, "CREATOR_APPLICATION_EXISTS", "Your creator application is already pending or approved.")
)

var (
	ErrProfileLimitStoreOrBusiness = httpserver.NewApiError(http.StatusConflict, "PROFILE_LIMIT_STORE_OR_BUSINESS", "You can have one Store or one Business page, not both.")
	ErrProfileLimitOneBrand        = httpserver.NewApiError(http.StatusConflict, "PROFILE_LIMIT_ONE_BRAND", "You can have one Brand.")
	ErrStoreLimitOne               = httpserver.NewApiError(http.StatusConflict, "STORE_LIMIT_ONE", "You can own one store. Your other business profiles can be brands that don't sell.")
	ErrBusinessProfileLimitPremium = httpserver.NewApiError(http.StatusConflict, "BUSINESS_PROFILE_LIMIT", "You can have up to 5 business profiles with Premium.")
	ErrProfileOnHold               = httpserver.NewApiError(http.StatusConflict, "PROFILE_ON_HOLD", "Choose which profiles to keep before using this one.")
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

func Conflict(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusConflict, code, message)
}

func NotFound(message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusNotFound, "NOT_FOUND", message)
}

func Forbidden(code, message string) *httpserver.ApiError {
	return httpserver.NewApiError(http.StatusForbidden, code, message)
}

func ValidationFailedFor(path, message string) *httpserver.ApiError {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func OrConflict(err error, code, message string) error {
	if err != nil {
		return err
	}
	return Conflict(code, message)
}

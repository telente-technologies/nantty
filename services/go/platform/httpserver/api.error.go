package httpserver

import (
	"errors"
	"net/http"
)

type ApiError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Issues  []ValidationIssue `json:"issues,omitempty"`

	Suggestions []string `json:"suggestions,omitempty"`
}

type ValidationIssue struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}

func (apiError *ApiError) Error() string { return apiError.Code + ": " + apiError.Message }

func NewApiError(status int, code, message string) *ApiError {
	return &ApiError{Status: status, Code: code, Message: message}
}

func (apiError *ApiError) WithSuggestions(suggestions []string) *ApiError {
	copied := *apiError
	copied.Suggestions = suggestions
	return &copied
}

func NewValidationFailedError(issues []ValidationIssue) *ApiError {
	return &ApiError{Status: http.StatusBadRequest, Code: "VALIDATION_FAILED", Message: "Validation failed", Issues: issues}
}

func NewForbiddenError(message string) *ApiError {
	return NewApiError(http.StatusForbidden, "FORBIDDEN", message)
}

var (
	ErrUnauthorized = NewApiError(http.StatusUnauthorized, "UNAUTHORIZED", "Sign in to continue.")
	ErrForbidden    = NewApiError(http.StatusForbidden, "FORBIDDEN", "You do not have permission to do that.")
	ErrNotFound     = NewApiError(http.StatusNotFound, "NOT_FOUND", "Not found.")
)

func ConvertErrorToApiError(err error) *ApiError {
	var apiError *ApiError
	if errors.As(err, &apiError) {
		return apiError
	}
	return NewApiError(http.StatusInternalServerError, "INTERNAL_ERROR", "Something went wrong.")
}

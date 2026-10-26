package services

import (
	"net/http"

	"nantty/platform/httpserver"
)

var (
	ErrAddressNotFound     = httpserver.NewApiError(http.StatusNotFound, "ADDRESS_NOT_FOUND", "That address was not found.")
	ErrAddressLimitReached = httpserver.NewApiError(http.StatusConflict, "ADDRESS_LIMIT_REACHED", "You can save up to 20 addresses. Remove one to add another.")
	ErrPostalCodeInvalid   = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "postalCode", Message: "is not valid for the selected country"}})
)

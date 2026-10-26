package services

import (
	"net/http"

	"nantty/platform/httpserver"
)

var (
	ErrDeletionAlreadyRequested = httpserver.NewApiError(http.StatusConflict, "DELETION_ALREADY_REQUESTED", "You already asked to delete this account.")
	ErrNoPendingDeletion        = httpserver.NewApiError(http.StatusNotFound, "DELETION_REQUEST_NOT_FOUND", "There is no pending deletion request.")
	ErrConfirmationRequired     = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "confirm", Message: "must be true to delete your account"}})
)

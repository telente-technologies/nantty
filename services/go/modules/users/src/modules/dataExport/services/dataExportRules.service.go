package services

import (
	"net/http"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/dataexportrequest"
	"nantty/platform/httpserver"
)

const ExportCooldown = 24 * time.Hour

var (
	ErrExportAlreadyActive = httpserver.NewApiError(http.StatusConflict, "EXPORT_ALREADY_ACTIVE", "A data export is already being prepared.")
	ErrExportRateLimited   = httpserver.NewApiError(http.StatusTooManyRequests, "EXPORT_RATE_LIMITED", "You can request one data export every 24 hours.")
	ErrExportNotFound      = httpserver.NewApiError(http.StatusNotFound, "EXPORT_NOT_FOUND", "That export was not found.")
)

func EvaluateExportRequestEligibility(now time.Time, existing []*ent.DataExportRequest) error {
	for _, request := range existing {
		if request.Status == dataexportrequest.StatusRequested || request.Status == dataexportrequest.StatusProcessing {
			return ErrExportAlreadyActive
		}
	}
	for _, request := range existing {
		if request.Status != dataexportrequest.StatusFailed && now.Sub(request.CreatedAt) < ExportCooldown {
			return ErrExportRateLimited
		}
	}
	return nil
}

func IsDownloadAvailable(request *ent.DataExportRequest, now time.Time) bool {
	return request.Status == dataexportrequest.StatusReady && request.ObjectKey != nil && request.ExpiresAt != nil && request.ExpiresAt.After(now)
}

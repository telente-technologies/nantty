package dtos

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/dataExport/services"
)

type DataExportResponse struct {
	Id            string  `json:"id"`
	Status        string  `json:"status"`
	RequestedAt   string  `json:"requestedAt"`
	CompletedAt   *string `json:"completedAt"`
	ExpiresAt     *string `json:"expiresAt"`
	SizeBytes     int64   `json:"sizeBytes"`
	DownloadUrl   *string `json:"downloadUrl"`
	FailureReason string  `json:"failureReason,omitempty"`
}

func ConvertExportToResponse(ctx context.Context, c *container.Container, row *ent.DataExportRequest) (DataExportResponse, error) {
	response := DataExportResponse{Id: row.ID.String(), Status: string(row.Status), RequestedAt: row.CreatedAt.UTC().Format(time.RFC3339), SizeBytes: row.SizeBytes, FailureReason: row.FailureReason}
	response.CompletedAt, response.ExpiresAt = formatOptional(row.CompletedAt), formatOptional(row.ExpiresAt)
	if !services.IsDownloadAvailable(row, c.Now()) {
		return response, nil
	}
	store, err := services.ObjectStoreFor(ctx, c.Settings.Privacy)
	if err != nil {
		return response, err
	}
	link, err := store.PresignGet(ctx, *row.ObjectKey, c.Settings.Privacy.ExportDownloadLinkTtl)
	response.DownloadUrl = &link
	return response, err
}

func formatOptional(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}

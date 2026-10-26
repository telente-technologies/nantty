package dtos

import (
	"encoding/json"
	"time"

	"nantty/modules/users/src/generated/ent"
	retentionmodels "nantty/modules/users/src/modules/retention/models"
)

type RequestDeletionRequest struct {
	Confirm bool   `json:"confirm"`
	Reason  string `json:"reason"`
}

type DeletionRequestResponse struct {
	Id              string                           `json:"id"`
	Status          string                           `json:"status"`
	Reason          string                           `json:"reason"`
	RequestedAt     string                           `json:"requestedAt"`
	ScheduledFor    string                           `json:"scheduledFor"`
	CancelledAt     *string                          `json:"cancelledAt"`
	ExecutedAt      *string                          `json:"executedAt"`
	RetentionPolicy []retentionmodels.PolicySnapshot `json:"retentionPolicy"`
}

func ConvertDeletionToResponse(row *ent.DeletionRequest) DeletionRequestResponse {
	var snapshot []retentionmodels.PolicySnapshot
	_ = json.Unmarshal(row.RetentionSnapshot, &snapshot)
	return DeletionRequestResponse{
		Id: row.ID.String(), Status: string(row.Status), Reason: row.Reason, RequestedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		ScheduledFor: row.ScheduledFor.UTC().Format(time.RFC3339), CancelledAt: formatOptional(row.CancelledAt), ExecutedAt: formatOptional(row.ExecutedAt), RetentionPolicy: snapshot,
	}
}

func formatOptional(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}

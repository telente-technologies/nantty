package dtos

import (
	"time"

	"nantty/modules/users/src/generated/ent"
)

type UpdateRetentionPolicyRequest struct {
	Action           string `json:"action"`
	RetentionDays    *int   `json:"retentionDays"`
	NeedsLegalReview *bool  `json:"needsLegalReview"`
	ExpectedVersion  int    `json:"expectedVersion"`
	Reason           string `json:"reason"`
}

type RetentionPolicyResponse struct {
	Category         string `json:"category"`
	Action           string `json:"action"`
	RetentionDays    *int   `json:"retentionDays"`
	NeedsLegalReview bool   `json:"needsLegalReview"`
	Version          int    `json:"version"`
	UpdatedBy        string `json:"updatedBy"`
	UpdatedAt        string `json:"updatedAt"`
}

func ConvertPolicyToResponse(row *ent.RetentionPolicy) RetentionPolicyResponse {
	return RetentionPolicyResponse{
		Category: string(row.Category), Action: string(row.Action), RetentionDays: row.RetentionDays, NeedsLegalReview: row.NeedsLegalReview,
		Version: row.Version, UpdatedBy: row.UpdatedBy, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

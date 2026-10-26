package services

import (
	"encoding/json"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/creatorapplication"
)

type ApplicationView struct {
	Id                 string   `json:"id"`
	Status             string   `json:"status"`
	ContentCategories  []string `json:"contentCategories"`
	SubmittedAt        string   `json:"submittedAt"`
	ReviewedAt         *string  `json:"reviewedAt"`
	RejectionReason    *string  `json:"rejectionReason"`
	ReapplyAvailableAt *string  `json:"reapplyAvailableAt"`
}

func formatOptional(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}

func ConvertApplicationToView(row *ent.CreatorApplication) ApplicationView {
	view := ApplicationView{
		Id: row.ID.String(), Status: string(row.Status), ContentCategories: row.ContentCategories, SubmittedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		ReviewedAt: formatOptional(row.ReviewedAt), ReapplyAvailableAt: formatOptional(row.ReapplyAvailableAt),
	}
	if view.ContentCategories == nil {
		view.ContentCategories = []string{}
	}
	if row.Status == creatorapplication.StatusRejected && row.DecisionReason != "" {
		reason := row.DecisionReason
		view.RejectionReason = &reason
	}
	return view
}

func RequirementsOfApplication(row *ent.CreatorApplication) []Requirement {
	var requirements []Requirement
	_ = json.Unmarshal(row.Requirements, &requirements)
	return requirements
}

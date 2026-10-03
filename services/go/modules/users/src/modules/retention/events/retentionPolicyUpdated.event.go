package events

const RetentionPolicyUpdatedType = "retentionPolicy.updated"

type RetentionPolicyUpdatedData struct {
	Category         string `json:"category"`
	Action           string `json:"action"`
	RetentionDays    *int   `json:"retentionDays"`
	NeedsLegalReview bool   `json:"needsLegalReview"`
	Version          int    `json:"version"`
	UpdatedBy        string `json:"updatedBy"`
}

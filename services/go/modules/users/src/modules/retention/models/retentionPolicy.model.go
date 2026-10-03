package models

var Categories = []string{"account", "orders", "financial", "messages", "analytics", "security_logs", "consents", "marketing"}

var Actions = []string{"delete", "anonymize", "retain"}

type PolicySnapshot struct {
	Category         string `json:"category"`
	Action           string `json:"action"`
	RetentionDays    *int   `json:"retentionDays"`
	NeedsLegalReview bool   `json:"needsLegalReview"`
}

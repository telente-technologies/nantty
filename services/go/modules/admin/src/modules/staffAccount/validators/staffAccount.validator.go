package validators

import (
	"regexp"
	"strings"
	"time"

	"nantty/modules/admin/src/modules/staffAccount/dtos"
	"nantty/modules/admin/src/utils/validation"
)

var (
	consentCategories    = map[string]bool{"essential": true, "analytics": true, "personalization": true, "advertising": true}
	consentSourcePattern = regexp.MustCompile(`^[a-z][a-z_]{1,39}$`)
)

func ValidateAddPasskeyRequest(request dtos.AddPasskeyRequest) error {
	collector := &validation.Collector{}
	label := strings.TrimSpace(request.Label)
	collector.RequireTrue("label", len(label) >= 1 && len([]rune(label)) <= 60, "must be 1 to 60 characters")
	collector.RequireTrue("credential", len(request.Credential) > 2 && len(request.Credential) <= 16384, "must be a passkey response")
	return collector.Result()
}

func ValidateRecordConsentRequest(request dtos.RecordConsentRequest) error {
	collector := &validation.Collector{}
	collector.RequireLength("policyVersion", strings.TrimSpace(request.PolicyVersion), 1, 40)
	decidedAt, err := time.Parse(time.RFC3339Nano, request.DecidedAt)
	collector.RequireTrue("decidedAt", err == nil && decidedAt.Before(time.Now().Add(5*time.Minute)), "must be an ISO timestamp that is not in the future")
	collector.RequireTrue("source", consentSourcePattern.MatchString(request.Source), "must be a short lower-case source name")
	known := len(request.Categories) > 0 && len(request.Categories) <= len(consentCategories)
	for category := range request.Categories {
		known = known && consentCategories[category]
	}
	collector.RequireTrue("categories", known, "must only list essential, analytics, personalization or advertising")
	return collector.Result()
}

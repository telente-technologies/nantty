package validators

import (
	"net/mail"
	"slices"
	"strings"

	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/modules/reporting/services"
	"zudomart/platform/httpserver"
)

func ValidateScheduledReport(input dtos.ScheduledReportInput) (dtos.ScheduledReportInput, error) {
	var issues []httpserver.ValidationIssue
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" || len(input.Name) > 120 {
		issues = append(issues, httpserver.ValidationIssue{Path: "name", Message: "Name must be 1-120 characters."})
	}
	if !services.IsKnownFrequency(input.Frequency) {
		issues = append(issues, httpserver.ValidationIssue{Path: "frequency", Message: "Choose daily, weekly or monthly."})
	}
	if !services.IsKnownBreakdown(input.Breakdown) {
		issues = append(issues, httpserver.ValidationIssue{Path: "breakdown", Message: "Unknown breakdown."})
	}
	if len(input.Metrics) < 1 || len(input.Metrics) > 14 {
		issues = append(issues, httpserver.ValidationIssue{Path: "metrics", Message: "Choose 1-14 metrics."})
	}
	for _, metric := range input.Metrics {
		if !services.IsKnownMetricKey(metric) {
			issues = append(issues, httpserver.ValidationIssue{Path: "metrics", Message: "Unknown metric " + metric + "."})
			break
		}
	}
	input.Metrics = slices.Compact(slices.Clone(input.Metrics))
	recipients := make([]string, 0, len(input.Recipients))
	for _, raw := range input.Recipients {
		address, err := mail.ParseAddress(strings.TrimSpace(raw))
		if err != nil || address.Name != "" || len(address.Address) > 254 {
			issues = append(issues, httpserver.ValidationIssue{Path: "recipients", Message: "Enter plain email addresses."})
			break
		}
		if lowered := strings.ToLower(address.Address); !slices.Contains(recipients, lowered) {
			recipients = append(recipients, lowered)
		}
	}
	if len(recipients) < 1 || len(recipients) > 10 {
		issues = append(issues, httpserver.ValidationIssue{Path: "recipients", Message: "Add 1-10 recipients."})
	}
	input.Recipients = recipients
	if len(issues) > 0 {
		return input, httpserver.NewValidationFailedError(issues)
	}
	return input, nil
}

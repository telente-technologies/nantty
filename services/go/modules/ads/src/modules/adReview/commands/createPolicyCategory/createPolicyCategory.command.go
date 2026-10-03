package createpolicycategory

import (
	"strings"

	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/platform/httpserver"
)

type Command struct{ Request dtos.PolicyCategoryRequest }

func ValidateFields(request dtos.PolicyCategoryRequest) error {
	var issues []httpserver.ValidationIssue
	if length := len(strings.TrimSpace(request.Name)); length < 3 || length > 60 {
		issues = append(issues, httpserver.ValidationIssue{Path: "name", Message: "Use 3-60 characters."})
	}
	if length := len(strings.TrimSpace(request.Description)); length < 10 || length > 400 {
		issues = append(issues, httpserver.ValidationIssue{Path: "description", Message: "Use 10-400 characters."})
	}
	switch request.Severity {
	case "LOW", "MEDIUM", "HIGH", "CRITICAL":
	default:
		issues = append(issues, httpserver.ValidationIssue{Path: "severity", Message: "Choose LOW, MEDIUM, HIGH or CRITICAL."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

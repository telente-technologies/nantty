package upsertcontentsignal

import (
	"nantty/modules/ads/src/modules/decision/dtos"
	"nantty/platform/httpserver"
)

func Validate(signal dtos.InternalContentSignal) error {
	var issues []httpserver.ValidationIssue
	if signal.ContentId == "" || len(signal.ContentId) > 80 {
		issues = append(issues, httpserver.ValidationIssue{Path: "contentId", Message: "is required (max 80 characters)"})
	}
	if signal.ContentKind == "" {
		issues = append(issues, httpserver.ValidationIssue{Path: "contentKind", Message: "is required"})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

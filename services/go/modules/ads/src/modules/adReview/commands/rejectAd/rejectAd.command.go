package rejectad

import (
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
	"nantty/platform/httpserver"
)

type Command struct {
	AdId     uuid.UUID
	Reviewer services.Reviewer
	Request  dtos.RejectRequest
}

func Validate(request dtos.RejectRequest) error {
	var issues []httpserver.ValidationIssue
	if strings.TrimSpace(request.PolicyCategoryId) == "" {
		issues = append(issues, httpserver.ValidationIssue{Path: "policyCategoryId", Message: "Choose the policy that was broken."})
	}
	if length := len(strings.TrimSpace(request.Reason)); length < 10 || length > 600 {
		issues = append(issues, httpserver.ValidationIssue{Path: "reason", Message: "Explain the rejection in 10-600 characters."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

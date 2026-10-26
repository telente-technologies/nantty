package applybulkaction

import (
	"slices"

	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/platform/httpserver"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.BulkActionRequest
}

func Validate(request dtos.BulkActionRequest) error {
	var issues []httpserver.ValidationIssue
	if !slices.Contains([]string{"campaign", "ad_set", "ad"}, request.Level) {
		issues = append(issues, httpserver.ValidationIssue{Path: "level", Message: "Choose campaign, ad_set or ad."})
	}
	if !slices.Contains([]string{"pause", "resume", "archive", "duplicate", "submit_for_review"}, request.Action) {
		issues = append(issues, httpserver.ValidationIssue{Path: "action", Message: "Unknown action."})
	}
	if len(request.Ids) == 0 || len(request.Ids) > 100 {
		issues = append(issues, httpserver.ValidationIssue{Path: "ids", Message: "Send 1-100 ids."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

package validators

import (
	"zudomart/modules/users/src/modules/retention/dtos"
	"zudomart/modules/users/src/modules/retention/models"
	"zudomart/modules/users/src/utils"
)

const maximumRetentionDays = 36500

func ValidateCategory(category string) error {
	collector := &utils.IssueCollector{}
	collector.RequireOneOf("category", category, models.Categories)
	return collector.Result()
}

func ValidateUpdateRetentionPolicyRequest(request dtos.UpdateRetentionPolicyRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireOneOf("action", request.Action, models.Actions)
	collector.RequireLength("reason", request.Reason, 5, 300)
	if request.NeedsLegalReview == nil {
		collector.Add("needsLegalReview", "is required")
	}
	if request.ExpectedVersion < 1 {
		collector.Add("expectedVersion", "must be the version you loaded")
	}
	if request.RetentionDays != nil && (*request.RetentionDays < 0 || *request.RetentionDays > maximumRetentionDays) {
		collector.Add("retentionDays", "must be between 0 and 36500")
	}
	return collector.Result()
}

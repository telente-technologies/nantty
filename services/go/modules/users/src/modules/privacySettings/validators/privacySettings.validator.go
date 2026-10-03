package validators

import (
	"regexp"

	"zudomart/modules/users/src/modules/privacySettings/dtos"
	"zudomart/modules/users/src/utils"
)

var policyVersionPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,40}$`)

func ValidateUpdatePrivacySettingsRequest(request dtos.UpdatePrivacySettingsRequest) error {
	collector := &utils.IssueCollector{}
	if request.Personalization == nil && request.PersonalizedAds == nil && request.Marketing == nil && request.Analytics == nil {
		collector.Add("body", "must change at least one setting")
	}
	if request.PolicyVersion != nil {
		collector.RequirePattern("policyVersion", *request.PolicyVersion, policyVersionPattern)
	}
	return collector.Result()
}

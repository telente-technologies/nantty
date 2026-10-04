package validators

import (
	"zudomart/modules/users/src/modules/celebrations/dtos"
	"zudomart/modules/users/src/utils"
)

func ValidateMarkSeenRequest(request dtos.MarkSeenRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireOneOf("kind", request.Kind, []string{"birthday", "anniversary"})
	collector.RequireOneOf("surface", request.Surface, []string{"app", "profile"})
	return collector.Result()
}

func ValidateUpdateSettingsRequest(request dtos.UpdateSettingsRequest) error {
	collector := &utils.IssueCollector{}
	if request.Timezone == nil && request.BirthdayBalloonsVisible == nil {
		collector.Add("body", "must change at least one setting")
	}
	if request.Timezone != nil && !utils.IsValidTimezone(*request.Timezone) {
		collector.Add("timezone", "must be an IANA timezone such as Africa/Lagos")
	}
	return collector.Result()
}

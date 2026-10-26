package validators

import (
	"nantty/modules/users/src/modules/accountSettings/dtos"
	"nantty/modules/users/src/utils"
)

var MarketingFrequencies = []string{"weekly", "important_only", "off"}

func ValidateUpdateSettingsRequest(request dtos.UpdateSettingsRequest) error {
	collector := &utils.IssueCollector{}
	if request.Theme != nil {
		collector.RequireOneOf("theme", *request.Theme, []string{"system", "light", "dark"})
	}
	if request.Language != nil {
		collector.RequireOneOf("language", *request.Language, []string{"en"})
	}
	if request.CountryCode != nil {
		collector.RequireLength("countryCode", *request.CountryCode, 2, 2)
	}
	return collector.Result()
}

func ValidateMarketingPreferencesRequest(request dtos.MarketingPreferencesRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireOneOf("frequency", request.Frequency, MarketingFrequencies)
	return collector.Result()
}

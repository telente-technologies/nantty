package validators

import (
	"nantty/modules/users/src/modules/profiles/dtos"
	"nantty/modules/users/src/utils"
)

func ValidateUpdateProfileRequest(request dtos.UpdateProfileRequest) error {
	collector := &utils.IssueCollector{}
	if request.Name != nil {
		collector.RequireLength("name", *request.Name, 0, 320)
	}
	if request.Bio != nil {
		collector.RequireLength("bio", *request.Bio, 0, 1200)
	}
	return collector.Result()
}

func ValidateUploadIntentRequest(request dtos.UploadIntentRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireOneOf("purpose", request.Purpose, []string{"avatar", "banner"})
	collector.RequireLength("contentType", request.ContentType, 5, 40)
	if request.SizeBytes <= 0 {
		collector.Add("sizeBytes", "must be positive")
	}
	return collector.Result()
}

func ValidatePreferencesRequest(request dtos.PreferencesRequest) error {
	collector := &utils.IssueCollector{}
	if request.CountryCode == nil && request.Theme == nil {
		collector.Add("theme", "Send a countryCode or a theme to change.")
	}
	if request.CountryCode != nil {
		collector.RequireLength("countryCode", *request.CountryCode, 2, 2)
	}
	if request.Theme != nil {
		collector.RequireOneOf("theme", *request.Theme, []string{"system", "light", "dark"})
	}
	return collector.Result()
}

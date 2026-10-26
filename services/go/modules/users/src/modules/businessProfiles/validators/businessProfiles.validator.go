package validators

import (
	"nantty/modules/users/src/modules/businessProfiles/dtos"
	"nantty/modules/users/src/utils"
)

func ValidateCreateBusinessProfileRequest(request dtos.CreateBusinessProfileRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("displayName", request.DisplayName, 2, 320)
	collector.RequireLength("handle", request.Handle, 1, 64)
	collector.RequireLength("description", request.Description, 0, 1200)
	if request.BusinessType != "" && request.BusinessType != "business" && request.BusinessType != "brand" && request.BusinessType != "government" {
		collector.Add("businessType", "must be business, brand or government")
	}
	if request.Purpose != "" && request.Purpose != "business" && request.Purpose != "store" {
		collector.Add("purpose", "must be business or store")
	}
	if len(request.Categories) == 0 || len(request.Categories) > 5 {
		collector.Add("categories", "must contain 1 to 5 entries")
	}
	return collector.Result()
}

func ValidateUpdateBusinessProfileRequest(request dtos.UpdateBusinessProfileRequest) error {
	collector := &utils.IssueCollector{}
	if request.DisplayName != nil {
		collector.RequireLength("displayName", *request.DisplayName, 2, 320)
	}
	if request.Description != nil {
		collector.RequireLength("description", *request.Description, 0, 1200)
	}
	return collector.Result()
}

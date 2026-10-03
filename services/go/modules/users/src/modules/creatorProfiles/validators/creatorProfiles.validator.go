package validators

import (
	"zudomart/modules/users/src/modules/creatorProfiles/dtos"
	"zudomart/modules/users/src/utils"
)

func ValidateCreateCreatorProfileRequest(request dtos.CreateCreatorProfileRequest) error {
	collector := &utils.IssueCollector{}
	if request.DisplayName != nil {
		collector.RequireLength("displayName", *request.DisplayName, 1, 320)
	}
	if request.Handle != nil {
		collector.RequireLength("handle", *request.Handle, 1, 64)
	}
	if request.Bio != nil {
		collector.RequireLength("bio", *request.Bio, 0, 1200)
	}
	return collector.Result()
}

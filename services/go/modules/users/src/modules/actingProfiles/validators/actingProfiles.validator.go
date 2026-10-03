package validators

import (
	"zudomart/modules/users/src/modules/actingProfiles/dtos"
	"zudomart/modules/users/src/utils"
)

func ValidateSwitchActingProfileRequest(request dtos.SwitchActingProfileRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("profileId", request.ProfileId, 36, 36)
	return collector.Result()
}

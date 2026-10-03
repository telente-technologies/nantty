package validators

import (
	"zudomart/modules/users/src/modules/accountDeletion/dtos"
	"zudomart/modules/users/src/modules/accountDeletion/services"
	"zudomart/modules/users/src/utils"
)

func ValidateRequestDeletionRequest(request dtos.RequestDeletionRequest) error {
	if !request.Confirm {
		return services.ErrConfirmationRequired
	}
	collector := &utils.IssueCollector{}
	collector.RequireLength("reason", request.Reason, 0, 300)
	return collector.Result()
}

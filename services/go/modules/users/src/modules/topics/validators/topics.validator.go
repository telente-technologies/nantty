package validators

import (
	"fmt"

	"nantty/modules/users/src/modules/topics/constants"
	"nantty/modules/users/src/modules/topics/dtos"
	"nantty/modules/users/src/utils"
)

func ValidateSaveTopicsRequest(request dtos.SaveTopicsRequest) error {
	collector := &utils.IssueCollector{}
	if len(request.TopicIds) < constants.MinimumSelectedTopics || len(request.TopicIds) > constants.MaximumSelectedTopics {
		collector.Add("topicIds", fmt.Sprintf("Pick %d to %d topics.", constants.MinimumSelectedTopics, constants.MaximumSelectedTopics))
	}
	for _, id := range request.TopicIds {
		collector.RequireLength("topicIds", id, 1, 40)
	}
	return collector.Result()
}

package dtos

import "zudomart/modules/users/src/generated/ent"

type TopicResponse struct {
	Id   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type SaveTopicsRequest struct {
	TopicIds []string `json:"topicIds"`
}

func ConvertTopicsToResponse(rows []*ent.Topic) []TopicResponse {
	items := make([]TopicResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, TopicResponse{Id: row.ID, Name: row.Name, Slug: row.ID})
	}
	return items
}

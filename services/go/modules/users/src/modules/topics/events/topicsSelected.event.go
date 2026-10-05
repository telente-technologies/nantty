package events

const TopicsSelectedType = "topics.selected"

type TopicsSelectedData struct {
	AccountId  string   `json:"accountId"`
	TopicIds   []string `json:"topicIds"`
	SelectedAt string   `json:"selectedAt"`
}

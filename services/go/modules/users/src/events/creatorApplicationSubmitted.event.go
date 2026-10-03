package events

type CreatorApplicationSubmittedEventData struct {
	AccountId          string `json:"accountId"`
	ApplicationId      string `json:"applicationId"`
	DecisionWithinDays int    `json:"decisionWithinDays"`
}

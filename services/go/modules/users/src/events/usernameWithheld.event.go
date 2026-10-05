package events

type UsernameWithheldEventData struct {
	Username         string `json:"username"`
	Reason           string `json:"reason"`
	AccountId        string `json:"accountId,omitempty"`
	AssignedUsername string `json:"assignedUsername,omitempty"`
}

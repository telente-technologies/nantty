package events

type UsernameWithheldEventData struct {
	Username string `json:"username"`
	Reason   string `json:"reason"`
}

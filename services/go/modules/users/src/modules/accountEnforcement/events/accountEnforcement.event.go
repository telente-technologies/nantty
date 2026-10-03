package events

const (
	AccountRestrictedType         = "account.restricted"
	SuspensionStartedType         = "suspension.started"
	SuspensionEndedType           = "suspension.ended"
	SuspensionAppealSubmittedType = "suspension.appealSubmitted"
	SuspensionAppealDecidedType   = "suspension.appealDecided"
	UsernameReassignedType        = "username.reassigned"
)

type AccountRestrictedData struct {
	AccountId string   `json:"accountId"`
	Features  []string `json:"features"`
	EndsAt    string   `json:"endsAt"`
	Reason    string   `json:"reason"`
}

type SuspensionStartedData struct {
	AccountId     string  `json:"accountId"`
	SuspensionId  string  `json:"suspensionId"`
	ReasonCode    string  `json:"reasonCode"`
	Reason        string  `json:"reason"`
	EndsAt        *string `json:"endsAt"`
	DeletionDueAt string  `json:"deletionDueAt"`
}

type SuspensionEndedData struct {
	AccountId    string `json:"accountId"`
	SuspensionId string `json:"suspensionId"`
	Outcome      string `json:"outcome"`
}

type SuspensionAppealData struct {
	AccountId    string `json:"accountId"`
	SuspensionId string `json:"suspensionId"`
	Outcome      string `json:"outcome,omitempty"`
	Reason       string `json:"reason,omitempty"`
}

type UsernameReassignedData struct {
	Username         string `json:"username"`
	FromAccountId    string `json:"fromAccountId"`
	FromNewUsername  string `json:"fromNewUsername"`
	ToAccountId      string `json:"toAccountId"`
	ToPreviousUserna string `json:"toPreviousUsername"`
	Reason           string `json:"reason"`
}

package events

const (
	AccountRestrictedType         = "account.restricted"
	AccountSuspendedType          = "account.suspended"
	AccountBannedType             = "account.banned"
	SuspensionEndedType           = "suspension.ended"
	SuspensionAppealSubmittedType = "suspension.appealSubmitted"
	AppealDecidedType             = "appeal.decided"
	UsernameReassignedType        = "username.reassigned"
	AccountWarnedType             = "account.warned"
	CommunityGuidelinesUrl        = "https://zudomart.com/community-guidelines"
	AppealUrl                     = "https://zudomart.com/settings/account/appeal"
)

type AccountRestrictedData struct {
	AccountId    string   `json:"accountId"`
	CaseId       string   `json:"caseId"`
	Reason       string   `json:"reason"`
	Policy       string   `json:"policy"`
	PolicyUrl    string   `json:"policyUrl"`
	AppealUrl    string   `json:"appealUrl"`
	Restrictions []string `json:"restrictions"`
	Until        string   `json:"until"`
}

type AccountSuspendedData struct {
	AccountId  string  `json:"accountId"`
	CaseId     string  `json:"caseId"`
	Reason     string  `json:"reason"`
	ReasonCode string  `json:"reasonCode"`
	Policy     string  `json:"policy"`
	PolicyUrl  string  `json:"policyUrl"`
	AppealUrl  string  `json:"appealUrl"`
	AppealBy   string  `json:"appealBy"`
	DeletionAt string  `json:"deletionAt"`
	Until      *string `json:"until"`
}

type AccountBannedData struct {
	AccountId string  `json:"accountId"`
	CaseId    string  `json:"caseId"`
	Reason    string  `json:"reason"`
	Policy    string  `json:"policy"`
	PolicyUrl string  `json:"policyUrl"`
	AppealUrl string  `json:"appealUrl"`
	Until     *string `json:"until"`
	Permanent bool    `json:"permanent"`
}

type SuspensionEndedData struct {
	AccountId    string `json:"accountId"`
	SuspensionId string `json:"suspensionId"`
	Outcome      string `json:"outcome"`
}

type SuspensionAppealData struct {
	AccountId    string `json:"accountId"`
	SuspensionId string `json:"suspensionId"`
}

type AppealDecidedData struct {
	AccountId   string `json:"accountId"`
	CaseId      string `json:"caseId"`
	Outcome     string `json:"outcome"`
	Explanation string `json:"explanation"`
}

type UsernameReassignedData struct {
	Username         string `json:"username"`
	FromAccountId    string `json:"fromAccountId"`
	FromNewUsername  string `json:"fromNewUsername"`
	ToAccountId      string `json:"toAccountId"`
	ToPreviousUserna string `json:"toPreviousUsername"`
	Reason           string `json:"reason"`
}

type AccountWarnedData struct {
	AccountId string `json:"accountId"`
	CaseId    string `json:"caseId,omitempty"`
	Reason    string `json:"reason"`
	Policy    string `json:"policy"`
	PolicyUrl string `json:"policyUrl"`
	AppealUrl string `json:"appealUrl"`
	Source    string `json:"source,omitempty"`
}

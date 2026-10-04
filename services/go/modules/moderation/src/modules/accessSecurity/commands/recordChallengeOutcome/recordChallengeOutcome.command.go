package recordchallengeoutcome

type Command struct {
	AttemptId  string   `json:"attemptId"`
	AccountId  string   `json:"accountId"`
	SessionId  string   `json:"sessionId"`
	DeviceId   string   `json:"deviceId"`
	IpPrefix   string   `json:"ipPrefix"`
	Passed     bool     `json:"passed"`
	Provider   string   `json:"provider"`
	ErrorCodes []string `json:"errorCodes"`
}

type Result struct {
	Requirement      string  `json:"requirement"`
	Reason           string  `json:"reason,omitempty"`
	ClearedUntil     *string `json:"clearedUntil"`
	Suspended        bool    `json:"suspended"`
	FailuresInWindow int     `json:"failuresInWindow"`
	FailuresAllowed  int     `json:"failuresAllowed"`
}

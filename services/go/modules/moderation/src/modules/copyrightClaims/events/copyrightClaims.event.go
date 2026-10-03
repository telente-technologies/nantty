package events

const (
	ClaimReceivedType         = "copyrightClaim.received"
	ClaimDecidedType          = "copyrightClaim.decided"
	CounterNoticeReceivedType = "copyrightClaim.counterNoticeReceived"
	CounterNoticeDecidedType  = "copyrightClaim.counterNoticeDecided"
	ClaimRestoredType         = "copyrightClaim.restored"
)

type ClaimReceivedData struct {
	ClaimId    string `json:"claimId"`
	TargetType string `json:"targetType"`
	TargetId   string `json:"targetId"`
}

type ClaimDecidedData struct {
	ClaimId       string `json:"claimId"`
	Outcome       string `json:"outcome"`
	TargetType    string `json:"targetType"`
	TargetId      string `json:"targetId"`
	ClaimantId    string `json:"claimantUserId,omitempty"`
	ClaimantEmail string `json:"claimantEmail"`
	InfringerId   string `json:"infringerId,omitempty"`
	Reason        string `json:"reason"`
	CanCounter    bool   `json:"canSubmitCounterNotice"`
}

type CounterNoticeReceivedData struct {
	ClaimId         string `json:"claimId"`
	NoticeId        string `json:"noticeId"`
	InfringerId     string `json:"infringerId"`
	RestoreEligible string `json:"restoreEligibleAt"`
}

type CounterNoticeDecidedData struct {
	ClaimId       string `json:"claimId"`
	NoticeId      string `json:"noticeId"`
	Outcome       string `json:"outcome"`
	ClaimantEmail string `json:"claimantEmail"`
	InfringerId   string `json:"infringerId,omitempty"`
	RestoreAt     string `json:"restoreEligibleAt"`
}

type ClaimRestoredData struct {
	ClaimId     string `json:"claimId"`
	TargetType  string `json:"targetType"`
	TargetId    string `json:"targetId"`
	InfringerId string `json:"infringerId,omitempty"`
}

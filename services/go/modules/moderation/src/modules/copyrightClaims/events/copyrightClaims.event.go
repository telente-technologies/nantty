package events

const (
	ClaimReceivedType         = "copyrightClaim.received"
	ClaimDecidedType          = "copyrightClaim.decided"
	CounterNoticeReceivedType = "copyrightClaim.counterNoticeReceived"
	CounterNoticeDecidedType  = "copyrightClaim.counterNoticeDecided"
	ClaimRestoredType         = "copyrightClaim.restored"
	AudioMuteOrderedType      = "copyrightClaim.audioMuteOrdered"
	WarningIssuedType         = "copyrightClaim.warningIssued"
	ContentTakenDownType      = "copyrightClaim.contentTakenDown"
	RemovedVoluntarilyType    = "copyrightClaim.contentRemovedVoluntarily"
)

type RemedyData struct {
	ClaimId     string `json:"claimId"`
	TargetType  string `json:"targetType"`
	TargetId    string `json:"targetId"`
	InfringerId string `json:"infringerId"`
	WorkTitle   string `json:"workTitle"`
	Reason      string `json:"reason"`
	DeadlineAt  string `json:"deadlineAt,omitempty"`
	WarningId   string `json:"warningId,omitempty"`
	StrikeId    string `json:"strikeId,omitempty"`
	CanCounter  bool   `json:"canSubmitCounterNotice"`
}

type ClaimReceivedData struct {
	ClaimId    string `json:"claimId"`
	TargetType string `json:"targetType"`
	TargetId   string `json:"targetId"`
	ClaimScope string `json:"claimScope"`
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
	Remedy        string `json:"remedy,omitempty"`
	DeadlineAt    string `json:"takedownDeadlineAt,omitempty"`
}

type CounterNoticeReceivedData struct {
	ClaimId         string `json:"claimId"`
	NoticeId        string `json:"noticeId"`
	InfringerId     string `json:"infringerId"`
	RestoreEligible string `json:"restoreEligibleAt"`
	ClaimantId      string `json:"claimantUserId,omitempty"`
	ClaimantEmail   string `json:"claimantEmail,omitempty"`
	TargetType      string `json:"targetType,omitempty"`
	TargetId        string `json:"targetId,omitempty"`
	WorkTitle       string `json:"workTitle,omitempty"`
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
	Remedy      string `json:"remedy,omitempty"`
	WorkTitle   string `json:"workTitle,omitempty"`
}

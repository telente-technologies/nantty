package dtos

type RestrictRequest struct {
	Features     []string `json:"features"`
	DurationDays int      `json:"durationDays"`
	Reason       string   `json:"reason"`
}

type SuspendRequest struct {
	DurationDays int    `json:"durationDays"`
	ReasonCode   string `json:"reasonCode"`
	Reason       string `json:"reason"`
}

type BanRequest struct {
	DurationDays *int   `json:"durationDays"`
	Reason       string `json:"reason"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type DeleteRequest struct {
	ConfirmUsername string `json:"confirmUsername"`
	Reason          string `json:"reason"`
}

type ReassignRequest struct {
	RecipientUserId string `json:"recipientUserId"`
	Reason          string `json:"reason"`
}

type AssignHeldRequest struct {
	Username   string `json:"username"`
	Reason     string `json:"reason"`
	BypassHold bool   `json:"bypassHold"`
}

type AppealRequest struct {
	Message string `json:"message"`
}

type AppealDecisionRequest struct {
	Outcome string `json:"outcome"`
	Reason  string `json:"reason"`
}

type InternalActionRequest struct {
	Action          string   `json:"action"`
	UserId          string   `json:"userId"`
	Actor           Actor    `json:"actor"`
	Reason          string   `json:"reason"`
	Features        []string `json:"features"`
	DurationDays    *int     `json:"durationDays"`
	ReasonCode      string   `json:"reasonCode"`
	Source          string   `json:"source"`
	CaseId          string   `json:"caseId"`
	ConfirmUsername string   `json:"confirmUsername"`
}

type Actor struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	IpAddress string `json:"ipAddress"`
	RequestId string `json:"requestId"`
	StepUp    bool   `json:"stepUp"`
}

type WarnRequest struct {
	Reason    string `json:"reason"`
	Policy    string `json:"policy"`
	AddStrike bool   `json:"addStrike"`
}

type ForceLogoutRequest struct {
	Reason    string `json:"reason"`
	SessionId string `json:"sessionId"`
}

type ReclaimRequest struct {
	Reason         string `json:"reason"`
	Mode           string `json:"mode"`
	ClaimantUserId string `json:"claimantUserId"`
}

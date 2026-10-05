package getsecurityoverview

type TwoStepVerificationView struct {
	Enabled   bool    `json:"enabled"`
	Method    *string `json:"method"`
	EnabledAt *string `json:"enabledAt"`
}

type SecuritySessionView struct {
	Id           string `json:"id"`
	Device       string `json:"device"`
	App          string `json:"app"`
	Location     string `json:"location"`
	IpAddress    string `json:"ipAddress"`
	SignedInAt   string `json:"signedInAt"`
	LastActiveAt string `json:"lastActiveAt"`
	IsCurrent    bool   `json:"isCurrent"`
}

type LoginHistoryView struct {
	Id         string `json:"id"`
	Outcome    string `json:"outcome"`
	Device     string `json:"device"`
	Location   string `json:"location"`
	IpAddress  string `json:"ipAddress"`
	OccurredAt string `json:"occurredAt"`
}

type SecurityOverviewView struct {
	TwoStepVerification TwoStepVerificationView `json:"twoStepVerification"`
	PasswordChangedAt   *string                 `json:"passwordChangedAt"`
	Sessions            []SecuritySessionView   `json:"sessions"`
	LoginHistory        []LoginHistoryView      `json:"loginHistory"`
}

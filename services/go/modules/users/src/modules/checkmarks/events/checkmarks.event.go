package events

const (
	CheckmarkChangedType                 = "profileCheckmark.changed"
	VerificationApplicationSubmittedType = "verificationApplication.submitted"
	VerificationApplicationDecidedType   = "verificationApplication.decided"
	BlackApplicationDecidedType          = "blackApplication.decided"
	BlackReverificationDueType           = "blackApplication.reverificationDue"
)

type CheckmarkChangedData struct {
	ProfileId      string  `json:"profileId"`
	AccountId      string  `json:"accountId"`
	Color          string  `json:"color"`
	Status         string  `json:"status"`
	Source         string  `json:"source"`
	Lifetime       bool    `json:"lifetime"`
	BadgeVisible   bool    `json:"badgeVisible"`
	HandleReserved bool    `json:"handleReserved"`
	PeriodEnd      *string `json:"currentPeriodEnd"`
}

type ApplicationEventData struct {
	ApplicationId string `json:"applicationId"`
	ProfileId     string `json:"profileId"`
	AccountId     string `json:"accountId"`
	Color         string `json:"color"`
	Status        string `json:"status,omitempty"`
	Reason        string `json:"reason,omitempty"`
}

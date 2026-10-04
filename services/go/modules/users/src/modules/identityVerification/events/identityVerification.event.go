package events

const (
	VerificationCaseOpenedType          = "verificationCase.opened"
	VerificationCaseDecidedType         = "verificationCase.decided"
	VerificationRefundRequestedType     = "verificationCase.refundRequested"
	VerificationFraudSignalDetectedType = "verification.fraudSignalDetected"
	VerificationEligibleNoticeType      = "verification.eligible"
	VerificationUnderReviewNoticeType   = "verification.underReview"
	VerificationApprovedNoticeType      = "verification.approved"
	VerificationRejectedNoticeType      = "verification.rejectedRefunded"
)

var RefundOutcomeEventTypes = []string{"verificationRefund.succeeded", "verificationRefund.notCharged", "verificationRefund.failed", "verificationRefund.manualStoreRefundRequired"}

type CaseEventData struct {
	CaseId         string `json:"caseId"`
	ProfileId      string `json:"profileId"`
	AccountId      string `json:"accountId"`
	Color          string `json:"color"`
	SubscriptionId string `json:"subscriptionId"`
	Status         string `json:"status"`
	Reason         string `json:"reason,omitempty"`
	AutoDecided    bool   `json:"autoDecided"`
}

type RefundRequestedData struct {
	CaseId         string `json:"caseId"`
	SubscriptionId string `json:"subscriptionId"`
	AccountId      string `json:"accountId"`
	Reason         string `json:"reason"`
	RefundScope    string `json:"refundScope"`
}

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type FraudSignalData struct {
	SuggestionId string   `json:"suggestionId"`
	AccountId    string   `json:"accountId"`
	CaseId       string   `json:"caseId"`
	Signals      []string `json:"signals"`
	RiskScore    int      `json:"riskScore"`
	AdvisoryOnly bool     `json:"advisoryOnly"`
}

type VerificationNotice struct {
	AccountId    string   `json:"accountId"`
	Checkmark    string   `json:"checkmark"`
	AccountName  string   `json:"accountName"`
	CaseId       string   `json:"caseId,omitempty"`
	DeepLink     string   `json:"deepLink,omitempty"`
	Reasons      []string `json:"reasons,omitempty"`
	RefundMethod string   `json:"refundMethod,omitempty"`
	RefundAmount *Money   `json:"refundAmount,omitempty"`
	ReapplyFrom  string   `json:"reapplyFrom,omitempty"`
	ReviewWithin int      `json:"reviewWithinDays,omitempty"`
	VerifiedAt   string   `json:"verifiedAt,omitempty"`
}

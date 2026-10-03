package dtos

import "time"

type CreateConnectedAccountRequestDto struct {
	AcceptPayments bool `json:"acceptPayments"`
}

type OnboardingLinkDto struct {
	Url       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type StartWebSubscriptionRequestDto struct {
	PlanCode string `json:"planCode"`
	ReturnTo string `json:"returnTo,omitempty"`
}

type DisputeEvidenceRequestDto struct {
	CustomerName       string `json:"customerName"`
	CustomerEmail      string `json:"customerEmail"`
	ProductDescription string `json:"productDescription"`
	Notes              string `json:"notes"`
}

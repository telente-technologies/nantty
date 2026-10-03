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

type ConnectedAccountIdentityRequestDto struct {
	FirstName              string `json:"firstName"`
	LastName               string `json:"lastName"`
	DateOfBirth            string `json:"dateOfBirth"`
	BankVerificationNumber string `json:"bvn"`
	NationalIdNumber       string `json:"nin"`
	PhoneNumber            string `json:"phoneNumber"`
	AddressLine1           string `json:"addressLine1"`
	City                   string `json:"city"`
	State                  string `json:"state"`
}

type InternalDomainEventDto struct {
	Type string `json:"type"`
	Data struct {
		AccountId string `json:"accountId"`
	} `json:"data"`
}

type PayoutDestinationRequestDto struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
	Currency      string `json:"currency"`
}

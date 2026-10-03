package dtos

import "time"

type IdentityRequestDto struct {
	LegalName          string `json:"legalName"`
	DateOfBirth        string `json:"dateOfBirth"`
	AddressLine1       string `json:"addressLine1"`
	City               string `json:"city"`
	State              string `json:"state"`
	IdType             string `json:"idType"`
	IdNumber           string `json:"idNumber"`
	RegisteredBusiness bool   `json:"registeredBusiness"`
}

type BusinessRequestDto struct {
	CacNumber    string `json:"cacNumber"`
	BusinessType string `json:"businessType"`
}

type ResolveRequestDto struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
}

type BankRequestDto struct {
	BankCode            string `json:"bankCode"`
	BankName            string `json:"bankName"`
	AccountNumber       string `json:"accountNumber"`
	ResolvedAccountName string `json:"resolvedAccountName"`
}

type DocumentLinkDto struct {
	Url       string    `json:"url"`
	ReturnUrl string    `json:"returnUrl"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type PayoutFeesDto struct {
	Currency        string   `json:"currency"`
	Kind            string   `json:"kind"`
	Fee             MoneyDto `json:"fee"`
	ArrivalEstimate string   `json:"arrivalEstimate"`
	FirstPayoutNote string   `json:"firstPayoutNote"`
}

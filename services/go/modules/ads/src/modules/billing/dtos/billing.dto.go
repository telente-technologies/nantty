package dtos

import "zudomart/modules/ads/src/types"

type AdCredits struct {
	Available    types.Money  `json:"available"`
	MonthlyGrant *types.Money `json:"monthlyGrant"`
	ExpiresAt    *string      `json:"expiresAt"`
	Source       *string      `json:"source"`
}

type SpendLimit struct {
	Amount *types.Money `json:"amount"`
	Spent  types.Money  `json:"spent"`
}

type BillingOverview struct {
	Balance                 types.Money   `json:"balance"`
	Credits                 AdCredits     `json:"credits"`
	SpendLimit              SpendLimit    `json:"spendLimit"`
	FundingMode             string        `json:"fundingMode"`
	PaymentMethods          []any         `json:"paymentMethods"`
	LowBalanceThreshold     types.Money   `json:"lowBalanceThreshold"`
	EstimatedDaysOfDelivery *int          `json:"estimatedDaysOfDelivery"`
	MinimumTopUp            types.Money   `json:"minimumTopUp"`
	MaximumTopUp            types.Money   `json:"maximumTopUp"`
	SuggestedTopUps         []types.Money `json:"suggestedTopUps"`
}

type BillingTransaction struct {
	Id               string      `json:"id"`
	Type             string      `json:"type"`
	Amount           types.Money `json:"amount"`
	Description      string      `json:"description"`
	Reference        string      `json:"reference"`
	CreatedAt        string      `json:"createdAt"`
	ReceiptAvailable bool        `json:"receiptAvailable"`
}

type SpendLimitRequest struct {
	Amount *types.Money `json:"amount"`
}

type FundingModeRequest struct {
	FundingMode string `json:"fundingMode"`
}

type CreditFundsRequest struct {
	Reference   string  `json:"reference"`
	Type        string  `json:"type"`
	AmountMinor int64   `json:"amountMinor"`
	Currency    string  `json:"currency"`
	Description string  `json:"description"`
	ExpiresAt   *string `json:"expiresAt"`
}

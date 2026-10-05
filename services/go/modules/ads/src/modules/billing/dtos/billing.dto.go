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
	ReportingSpend          *types.Money  `json:"reportingSpend"`
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

type StartTopUpRequest struct {
	Amount     types.Money `json:"amount"`
	Provider   string      `json:"provider"`
	ReturnPath string      `json:"returnPath"`
}

type TopUpCheckout struct {
	TopUpId          string `json:"topUpId"`
	Reference        string `json:"reference"`
	Provider         string `json:"provider"`
	AuthorizationUrl string `json:"authorizationUrl"`
	AccessCode       string `json:"accessCode"`
}

type TopUp struct {
	Id            string      `json:"id"`
	Reference     string      `json:"reference"`
	Amount        types.Money `json:"amount"`
	Status        string      `json:"status"`
	Provider      string      `json:"provider"`
	CreatedAt     string      `json:"createdAt"`
	CompletedAt   *string     `json:"completedAt"`
	FailureReason *string     `json:"failureReason"`
}

type Invoice struct {
	Id          string      `json:"id"`
	Number      string      `json:"number"`
	PeriodStart string      `json:"periodStart"`
	PeriodEnd   string      `json:"periodEnd"`
	Subtotal    types.Money `json:"subtotal"`
	Tax         types.Money `json:"tax"`
	Total       types.Money `json:"total"`
	Status      string      `json:"status"`
	IssuedAt    string      `json:"issuedAt"`
}

package dtos

import "time"

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type StartTopUpRequestDto struct {
	AdAccountId string   `json:"adAccountId"`
	Amount      MoneyDto `json:"amount"`
	ReturnTo    string   `json:"returnTo"`
}

type TopUpDto struct {
	Id          string   `json:"id"`
	AdAccountId string   `json:"adAccountId"`
	Reference   string   `json:"reference"`
	Status      string   `json:"status"`
	Amount      MoneyDto `json:"amount"`
	CheckoutUrl *string  `json:"checkoutUrl"`
	Provider    string   `json:"provider,omitempty"`
}

type AdBalanceDto struct {
	AdAccountId string   `json:"adAccountId"`
	Balance     MoneyDto `json:"balance"`
}

type SpendBatchRequestDto struct {
	BatchId         string `json:"batchId"`
	AccountId       string `json:"accountId"`
	Currency        string `json:"currency"`
	DebitMinor      int64  `json:"debitMinor"`
	ImpressionCount int64  `json:"impressionCount"`
	IdempotencyKey  string `json:"idempotencyKey"`
}

type SpendBatchResultDto struct {
	DebitedMinor   int64 `json:"debitedMinor"`
	ShortfallMinor int64 `json:"shortfallMinor"`
	Replayed       bool  `json:"replayed"`
}

type BoostDebitRequestDto struct {
	UserId              string   `json:"userId"`
	Amount              MoneyDto `json:"amount"`
	IdempotencyKey      string   `json:"idempotencyKey"`
	DebitIdempotencyKey string   `json:"debitIdempotencyKey"`
}

type BoostDebitResultDto struct {
	LedgerTransactionId string   `json:"ledgerTransactionId"`
	BalanceAfter        MoneyDto `json:"balanceAfter"`
	Replayed            bool     `json:"replayed"`
}

type InternalStartTopUpRequestDto struct {
	UserId   string   `json:"userId"`
	Amount   MoneyDto `json:"amount"`
	ReturnTo string   `json:"returnTo"`
}

type TopUpStatusDto struct {
	Id             string     `json:"id"`
	AdAccountId    string     `json:"adAccountId"`
	Reference      string     `json:"reference"`
	Amount         MoneyDto   `json:"amount"`
	Status         string     `json:"status"`
	Provider       string     `json:"provider"`
	FundedByUserId string     `json:"fundedByUserId"`
	CreatedAt      time.Time  `json:"createdAt"`
	CompletedAt    *time.Time `json:"completedAt"`
}

type EarningsFundingRequestDto struct {
	UserId string   `json:"userId"`
	Amount MoneyDto `json:"amount"`
}

type EarningsFundingDto struct {
	FundingId   string    `json:"fundingId"`
	AdAccountId string    `json:"adAccountId"`
	Amount      MoneyDto  `json:"amount"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	Replayed    bool      `json:"replayed"`
}

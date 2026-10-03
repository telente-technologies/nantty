package dtos

import "time"

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type PayoutAccountDto struct {
	Id                  string `json:"id"`
	BankCode            string `json:"bankCode"`
	BankName            string `json:"bankName"`
	AccountNumberMasked string `json:"accountNumberMasked"`
	AccountName         string `json:"accountName"`
	CountryCode         string `json:"countryCode"`
	IsDefault           bool   `json:"isDefault"`
	NameMatchStatus     string `json:"nameMatchStatus"`
}

type AddPayoutAccountRequestDto struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
	CountryCode   string `json:"countryCode,omitempty"`
}

type WithdrawalRequestDto struct {
	PayoutAccountId string   `json:"payoutAccountId"`
	Amount          MoneyDto `json:"amount"`
}

type WithdrawalQuoteDto struct {
	Amount          MoneyDto `json:"amount"`
	Fee             MoneyDto `json:"fee"`
	NetAmount       MoneyDto `json:"netAmount"`
	PayoutAccountId string   `json:"payoutAccountId"`
}

type WalletTransactionDto struct {
	Id          string    `json:"id"`
	Kind        string    `json:"kind"`
	Amount      MoneyDto  `json:"amount"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	Status      string    `json:"status"`
}

type WithdrawalDto struct {
	WalletTransactionDto
	Reference        string     `json:"reference"`
	Fee              MoneyDto   `json:"fee"`
	NetAmount        MoneyDto   `json:"netAmount"`
	WithdrawalStatus string     `json:"withdrawalStatus"`
	PayoutAccountId  string     `json:"payoutAccountId"`
	FailureReason    *string    `json:"failureReason"`
	ProcessedAt      *time.Time `json:"processedAt"`
}

type WalletSummaryDto struct {
	Available       MoneyDto   `json:"available"`
	Pending         MoneyDto   `json:"pending"`
	Locked          MoneyDto   `json:"locked"`
	InEscrow        MoneyDto   `json:"inEscrow"`
	PayoutRequested MoneyDto   `json:"payoutRequested"`
	NegativeBalance MoneyDto   `json:"negativeBalance"`
	NextAvailableAt *time.Time `json:"nextAvailableAt"`
}

type ReviewWithdrawalRequestDto struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

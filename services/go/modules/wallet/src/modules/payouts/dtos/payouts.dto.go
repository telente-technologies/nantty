package dtos

import (
	"time"

	ledgerrepositories "zudomart/modules/ledger/src/repositories"
)

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
	Available       MoneyDto              `json:"available"`
	Pending         MoneyDto              `json:"pending"`
	Locked          MoneyDto              `json:"locked"`
	InEscrow        MoneyDto              `json:"inEscrow"`
	PayoutRequested MoneyDto              `json:"payoutRequested"`
	NegativeBalance MoneyDto              `json:"negativeBalance"`
	NextAvailableAt *time.Time            `json:"nextAvailableAt"`
	AdCredit        MoneyDto              `json:"adCredit"`
	EarningsPayable MoneyDto              `json:"earningsPayable"`
	Debts           MoneyDto              `json:"debts"`
	Coins           CoinHoldingsDto       `json:"coins"`
	Lines           []WalletLineDto       `json:"lines"`
	Verification    WalletVerificationDto `json:"verification"`
}

type CoinHoldingsDto struct {
	Spendable int64 `json:"spendable"`
	Earned    int64 `json:"earned"`
}

type WalletLineDto struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Amount      MoneyDto `json:"amount"`
}

type WalletVerificationDto struct {
	Level                  int      `json:"level"`
	WithdrawalsUnlocked    bool     `json:"withdrawalsUnlocked"`
	WaitingForVerification MoneyDto `json:"waitingForVerification"`
	NextStep               *string  `json:"nextStep"`
	Message                *string  `json:"message"`
}

type ReviewWithdrawalRequestDto struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

type PayoutDestinationDto struct {
	PayoutAccountId string    `json:"payoutAccountId"`
	BankName        string    `json:"bankName"`
	AccountLast4    string    `json:"accountLast4"`
	AccountName     string    `json:"accountName"`
	CountryCode     string    `json:"countryCode"`
	AddedAt         time.Time `json:"addedAt"`
	Removed         bool      `json:"removed"`
}

type StaffWithdrawalDto struct {
	WithdrawalDto
	UserId            string                          `json:"userId"`
	User              ledgerrepositories.PartySummary `json:"user"`
	Provider          string                          `json:"provider"`
	Destination       *PayoutDestinationDto           `json:"destination"`
	ReviewedByStaffId *string                         `json:"reviewedByStaffId"`
	ReviewedAt        *time.Time                      `json:"reviewedAt"`
	ReviewNote        *string                         `json:"reviewNote"`
	AgeHours          int                             `json:"ageHours"`
}

type RecentWithdrawalDto struct {
	Id               string    `json:"id"`
	Amount           MoneyDto  `json:"amount"`
	WithdrawalStatus string    `json:"withdrawalStatus"`
	CreatedAt        time.Time `json:"createdAt"`
}

type StaffWithdrawalDetailDto struct {
	StaffWithdrawalDto
	AvailableBalance  MoneyDto              `json:"availableBalance"`
	RecentWithdrawals []RecentWithdrawalDto `json:"recentWithdrawals"`
}

type StaffWithdrawalListDto struct {
	Data       []StaffWithdrawalDto `json:"data"`
	NextCursor *string              `json:"nextCursor"`
	Counts     map[string]int       `json:"counts"`
}

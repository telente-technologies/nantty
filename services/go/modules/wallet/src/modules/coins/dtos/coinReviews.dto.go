package dtos

import (
	"time"

	ledgerrepositories "zudomart/modules/ledger/src/repositories"
)

type CoinTransactionDto struct {
	Id                     string                           `json:"id"`
	Kind                   string                           `json:"kind"`
	Reference              *string                          `json:"reference"`
	Sender                 ledgerrepositories.PartySummary  `json:"sender"`
	Receiver               *ledgerrepositories.PartySummary `json:"receiver"`
	Coins                  int64                            `json:"coins"`
	FeeCoins               *int64                           `json:"feeCoins"`
	PlatformFeeBasisPoints *int64                           `json:"platformFeeBasisPoints"`
	FiatValue              *MoneyDto                        `json:"fiatValue"`
	PaymentProvider        *string                          `json:"paymentProvider"`
	Channel                *string                          `json:"channel"`
	TransactionStatus      string                           `json:"transactionStatus"`
	ReviewStatus           string                           `json:"reviewStatus"`
	Flags                  []string                         `json:"flags"`
	ChargebackRisk         string                           `json:"chargebackRisk"`
	ClawbackShortfallCoins int64                            `json:"clawbackShortfallCoins"`
	CreatedAt              time.Time                        `json:"createdAt"`
	ReviewedAt             *time.Time                       `json:"reviewedAt"`
	ReviewedByStaffId      *string                          `json:"reviewedByStaffId"`
	ReviewNote             *string                          `json:"reviewNote"`
}

type CoinTransactionHistoryDto struct {
	Action     string    `json:"action"`
	OccurredAt time.Time `json:"occurredAt"`
	StaffId    *string   `json:"staffId"`
	Note       *string   `json:"note"`
}

type CoinTransactionDetailDto struct {
	CoinTransactionDto
	History []CoinTransactionHistoryDto `json:"history"`
}

type CoinTransactionListDto struct {
	Data       []CoinTransactionDto `json:"data"`
	NextCursor *string              `json:"nextCursor"`
	Counts     map[string]int       `json:"counts"`
}

type CoinReviewRequestDto struct {
	Reason string `json:"reason"`
}

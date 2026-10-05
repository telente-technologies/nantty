package dtos

import (
	"time"

	"github.com/google/uuid"

	"zudomart/platform/money"
)

type SellerContext struct {
	SellerId    string
	StoreId     uuid.UUID
	StoreName   string
	Currency    string
	CountryCode string
	Location    *time.Location
	ActorId     string
}

func (context SellerContext) Money(amountMinor int64) money.Money {
	return money.Money{AmountMinor: amountMinor, Currency: money.CurrencyCode(context.Currency)}
}

type WalletBalancesView struct {
	Escrow              money.Money `json:"escrow"`
	Pending             money.Money `json:"pending"`
	Available           money.Money `json:"available"`
	NextEscrowReleaseAt *string     `json:"nextEscrowReleaseAt"`
}

type WalletTransactionView struct {
	Id            string      `json:"id"`
	Kind          string      `json:"kind"`
	Description   string      `json:"description"`
	Amount        money.Money `json:"amount"`
	Direction     string      `json:"direction"`
	BalanceBucket string      `json:"balanceBucket"`
	Reference     string      `json:"reference"`
	CreatedAt     string      `json:"createdAt"`
}

type PayoutAccountView struct {
	Id                  string `json:"id"`
	BankName            string `json:"bankName"`
	BankCode            string `json:"bankCode"`
	AccountNameMasked   string `json:"accountNameMasked"`
	AccountNumberMasked string `json:"accountNumberMasked"`
	IsDefault           bool   `json:"isDefault"`
	Verified            bool   `json:"verified"`
}

type ResolvedPayoutAccountView struct {
	ResolutionId        string `json:"resolutionId"`
	BankCode            string `json:"bankCode"`
	BankName            string `json:"bankName"`
	AccountNameMasked   string `json:"accountNameMasked"`
	AccountNumberMasked string `json:"accountNumberMasked"`
}

type PayoutView struct {
	Id             string      `json:"id"`
	Amount         money.Money `json:"amount"`
	Fee            money.Money `json:"fee"`
	AccountId      string      `json:"accountId"`
	AccountSummary string      `json:"accountSummary"`
	Status         string      `json:"status"`
	Reference      string      `json:"reference"`
	RequestedAt    string      `json:"requestedAt"`
	CompletedAt    *string     `json:"completedAt"`
}

type PayoutSettingsView struct {
	MinimumPayout money.Money `json:"minimumPayout"`
	Fee           money.Money `json:"fee"`
	Schedule      string      `json:"schedule"`
}

type BankView struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type PayoutScheduleView struct {
	Mode               string      `json:"mode"`
	Weekday            int         `json:"weekday"`
	DayOfMonth         int         `json:"dayOfMonth"`
	KeepMinimumBalance money.Money `json:"keepMinimumBalance"`
	AccountId          *string     `json:"accountId"`
	NextRunAt          *string     `json:"nextRunAt"`
}

type RequestPayoutBody struct {
	AmountMinor int64  `json:"amountMinor"`
	AccountId   string `json:"accountId"`
}

type ResolvePayoutAccountBody struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
}

type AddPayoutAccountBody struct {
	ResolutionId string `json:"resolutionId"`
}

type UpdatePayoutAccountBody struct {
	IsDefault bool `json:"isDefault"`
}

type SavePayoutScheduleBody struct {
	Mode                    string  `json:"mode"`
	Weekday                 int     `json:"weekday"`
	DayOfMonth              int     `json:"dayOfMonth"`
	KeepMinimumBalanceMinor int64   `json:"keepMinimumBalanceMinor"`
	AccountId               *string `json:"accountId"`
}

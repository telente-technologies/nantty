package interfaces

import (
	"context"
	"errors"
)

type SellerPayoutInstruction struct {
	WithdrawalId  string
	UserId        string
	Reference     string
	AmountMinor   int64
	FeeMinor      int64
	Currency      string
	BankCode      string
	AccountNumber string
}

type SellerSettlementAdapter interface {
	Name() string
	SettleSellerPayout(ctx context.Context, instruction SellerPayoutInstruction) (string, error)
}

var ErrPayoutNotSentRetryLater = errors.New("payout was not sent to the provider; retry in a later run")

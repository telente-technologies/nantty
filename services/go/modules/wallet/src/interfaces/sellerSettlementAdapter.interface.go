package interfaces

import (
	"context"
	"errors"
)

type SellerPayoutInstruction struct {
	WithdrawalId  string
	Reference     string
	Provider      string
	AmountMinor   int64
	Currency      string
	BankCode      string
	AccountNumber string
	AccountName   string
}

type SellerSettlementAdapter interface {
	Name() string
	SettleSellerPayout(ctx context.Context, instruction SellerPayoutInstruction) (string, error)
}

var ErrSettlementAdapterNotImplemented = errors.New("seller settlement adapter is not implemented yet")

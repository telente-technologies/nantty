package interfaces

import (
	"context"
	"database/sql"
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

type TransactionalSettlementAdapter interface {
	SellerSettlementAdapter
	PrepareSellerPayoutInTransaction(ctx context.Context, transaction *sql.Tx, instruction SellerPayoutInstruction) error
	SendPreparedSellerPayout(ctx context.Context, reference string) (string, error)
}

const PayoutTransferMissing = "missing"

var ErrPayoutNotSentRetryLater = errors.New("payout was not sent to the provider; retry in a later run")

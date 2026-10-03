package interfaces

import "context"

type PayeeBankAccount struct {
	UserId        string
	AccountName   string
	BankCode      string
	AccountNumber string
	Currency      string
}

type SettlementSubaccountRequest struct {
	PayeeBankAccount
	BusinessName     string
	ManualSettlement bool
}

type PayeeProvider interface {
	FindTransferRecipient(ctx context.Context, account PayeeBankAccount) (string, bool, error)
	CreateTransferRecipient(ctx context.Context, account PayeeBankAccount) (string, error)
	FindSettlementSubaccount(ctx context.Context, request SettlementSubaccountRequest) (string, bool, error)
	CreateSettlementSubaccount(ctx context.Context, request SettlementSubaccountRequest) (string, error)
}

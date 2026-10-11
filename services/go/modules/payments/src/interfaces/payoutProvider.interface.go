package interfaces

import (
	"context"
	"time"
)

type TransferRequest struct {
	RecipientCode   string
	AmountMinor     int64
	Currency        string
	Reference       string
	Reason          string
	SourceWalletRef string
	BankCode        string
	AccountNumber   string
	BeneficiaryName string
	BranchCode      string
}

type TransferResult struct {
	ProviderTransferId string
	Outcome            ProviderOutcome
	FeeMinor           int64
	FailureReason      string
}

type ProviderBalance struct {
	Currency       string
	AvailableMinor int64
}

type ProviderSettlement struct {
	ProviderSettlementId string
	SubaccountCode       string
	Status               string
	AmountMinor          int64
	Currency             string
	SettledAt            *time.Time
}

type PayoutProvider interface {
	CreateTransfer(ctx context.Context, request TransferRequest) (TransferResult, error)
	VerifyTransfer(ctx context.Context, reference string) (TransferResult, error)
	ReadPlatformBalances(ctx context.Context) ([]ProviderBalance, error)
	ListSettlements(ctx context.Context, subaccountCode string, from, to time.Time) ([]ProviderSettlement, error)
	ListSettlementChargeReferences(ctx context.Context, providerSettlementId string) ([]string, error)
	QuotePayoutFee(currency string, amountMinor int64) (int64, error)
}

package interfaces

import "context"

type TransferRequest struct {
	FromConnectedAccountId string
	ToConnectedAccountId   string
	AmountMinor            int64
	Currency               string
	TransferGroup          string
	Description            string
	IdempotencyKey         string
	Metadata               map[string]string
}

type TransferResult struct {
	ProviderTransferId string
	Outcome            ProviderOutcome
	FailureReason      string
}

type PayoutDestinationRequest struct {
	ConnectedAccountId string
	Currency           string
	BankCode           string
	AccountNumber      string
	IdempotencyKey     string
}

type PayoutDestination struct {
	ProviderDestinationId string
	AccountName           string
	Usable                bool
}

type PayoutRequest struct {
	ConnectedAccountId    string
	ProviderDestinationId string
	AmountMinor           int64
	Currency              string
	Reference             string
	IdempotencyKey        string
}

type PayoutLookup struct {
	ConnectedAccountId string
	ProviderPayoutId   string
}

type PayoutResult struct {
	ProviderPayoutId  string
	Outcome           ProviderOutcome
	FeeMinor          int64
	TotalDebitedMinor int64
	FailureReason     string
}

type ProviderBalance struct {
	Currency       string
	AvailableMinor int64
	PendingMinor   int64
}

type MoneyMovementProvider interface {
	CreateTransfer(ctx context.Context, request TransferRequest) (TransferResult, error)
	ReadTransfer(ctx context.Context, providerTransferId string) (TransferResult, error)
	CreatePayoutDestination(ctx context.Context, request PayoutDestinationRequest) (PayoutDestination, error)
	CreatePayout(ctx context.Context, request PayoutRequest) (PayoutResult, error)
	ReadPayout(ctx context.Context, lookup PayoutLookup) (PayoutResult, error)
	ReadBalances(ctx context.Context, connectedAccountId string) ([]ProviderBalance, error)
	QuotePayoutFee(currency string, amountMinor int64) (int64, error)
}

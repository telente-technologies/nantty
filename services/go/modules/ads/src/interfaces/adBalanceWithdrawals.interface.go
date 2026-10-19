package interfaces

import "context"

type AdBalanceWithdrawalRequest struct {
	UserId         string
	AdAccountId    string
	Currency       string
	GrossMinor     int64
	FeeMinor       int64
	IdempotencyKey string
}

type AdBalanceWithdrawalGateway interface {
	MoveAdBalanceToWallet(ctx context.Context, request AdBalanceWithdrawalRequest) error
}

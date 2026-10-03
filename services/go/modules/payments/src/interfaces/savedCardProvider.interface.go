package interfaces

import "context"

type AuthorizationChargeRequest struct {
	CustomerEmail      string
	AuthorizationCode  string
	Reference          string
	AmountMinor        int64
	Currency           string
	SettlementAccount  string
	SubaccountBearsFee bool
	Metadata           map[string]string
}

type AuthorizationChargeResult struct {
	ProviderChargeId string
	Outcome          ProviderOutcome
	Paused           bool
	AuthorizationUrl string
	FailureReason    string
}

type SavedCardProvider interface {
	ChargeAuthorization(ctx context.Context, request AuthorizationChargeRequest) (AuthorizationChargeResult, error)
}

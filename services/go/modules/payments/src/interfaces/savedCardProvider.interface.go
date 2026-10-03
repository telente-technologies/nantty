package interfaces

import (
	"context"
	"errors"
)

type ProviderCustomerRequest struct {
	Email          string
	Name           string
	IdempotencyKey string
}

type SaveCardCheckoutRequest struct {
	ProviderCustomerId string
	Reference          string
	SuccessUrl         string
	CancelUrl          string
	IdempotencyKey     string
	Metadata           map[string]string
}

type SavedCardChargeRequest struct {
	ProviderCustomerId string
	PaymentMethodId    string
	ConnectedAccountId string
	Reference          string
	Description        string
	AmountMinor        int64
	Currency           string
	IdempotencyKey     string
}

type SavedCardChargeResult struct {
	ProviderChargeId       string
	Outcome                ProviderOutcome
	RequiresHostedCheckout bool
	FailureReason          string
}

type SavedPaymentMethod struct {
	PaymentMethodId     string
	ProviderCustomerId  string
	Brand               string
	Last4               string
	ExpiryMonth         int
	ExpiryYear          int
	ProviderFingerprint string
	IsDefault           bool
}

type SavedCardProvider interface {
	CreateCustomer(ctx context.Context, request ProviderCustomerRequest) (string, error)
	CreateSaveCardCheckout(ctx context.Context, request SaveCardCheckoutRequest) (ChargeSession, error)
	ChargeSavedCard(ctx context.Context, request SavedCardChargeRequest) (SavedCardChargeResult, error)
}

var (
	ErrSavedCardNotForCustomer = errors.New("the saved card does not belong to this customer")
)

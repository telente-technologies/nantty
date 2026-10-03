package interfaces

import (
	"context"
	"time"
)

type ProviderDispute struct {
	ProviderDisputeId  string
	ProviderChargeId   string
	ConnectedAccountId string
	AmountMinor        int64
	Currency           string
	Status             string
	Reason             string
	ResponseDeadlineAt *time.Time
}

type DisputeEvidence struct {
	ConnectedAccountId string
	ProviderDisputeId  string
	CustomerName       string
	CustomerEmail      string
	ProductDescription string
	Notes              string
	IdempotencyKey     string
}

type DisputeProvider interface {
	ListOpenDisputes(ctx context.Context, connectedAccountId string) ([]ProviderDispute, error)
	SubmitDisputeEvidence(ctx context.Context, evidence DisputeEvidence) error
}

type RecurringPlanRequest struct {
	Name                string
	AmountMinor         int64
	Currency            string
	BillingIntervalUnit string
	BillingIntervalSize int
	TrialDays           int
	IdempotencyKey      string
}

type SubscriptionCheckoutRequest struct {
	ProviderProductId  string
	ProviderCustomerId string
	Reference          string
	CustomerEmail      string
	CustomerName       string
	SuccessUrl         string
	CancelUrl          string
	IdempotencyKey     string
	Metadata           map[string]string
}

type ProviderSubscriptionUpdate struct {
	ProviderSubscriptionId string
	ProviderCustomerId     string
	Status                 string
	TrialEndsAt            *time.Time
	CurrentPeriodEndsAt    *time.Time
	CancellationReason     string
	Metadata               map[string]string
}

type SubscriptionProvider interface {
	CreateRecurringPlan(ctx context.Context, request RecurringPlanRequest) (string, error)
	CreateSubscriptionCheckout(ctx context.Context, request SubscriptionCheckoutRequest) (ChargeSession, error)
	CancelSubscription(ctx context.Context, providerSubscriptionId, idempotencyKey string) error
	ScheduleSubscriptionCancellation(ctx context.Context, request SubscriptionCancellationRequest) error
	ChangeSubscriptionProduct(ctx context.Context, request SubscriptionProductChange) error
}

type SubscriptionCancellationRequest struct {
	ProviderSubscriptionId string
	AtPeriodEnd            bool
	Reason                 string
	IdempotencyKey         string
}

type SubscriptionProductChange struct {
	ProviderSubscriptionId string
	ProviderProductId      string
	ProrationBehavior      string
	IdempotencyKey         string
}

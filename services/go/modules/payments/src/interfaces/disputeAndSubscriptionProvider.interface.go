package interfaces

import (
	"context"
	"time"
)

type ProviderDispute struct {
	ProviderDisputeId  string
	ProviderChargeId   string
	ChargeReference    string
	AmountMinor        int64
	Currency           string
	Status             string
	Reason             string
	ResponseDeadlineAt *time.Time
}

type DisputeEvidence struct {
	ProviderDisputeId  string
	CustomerName       string
	CustomerEmail      string
	ProductDescription string
	Notes              string
}

type DisputeProvider interface {
	ListOpenDisputes(ctx context.Context) ([]ProviderDispute, error)
	SubmitDisputeEvidence(ctx context.Context, evidence DisputeEvidence) error
}

type RecurringPlanRequest struct {
	Name        string
	AmountMinor int64
	Currency    string
	Interval    string
}

type SubscriptionRequest struct {
	ProviderCustomerId string
	PlanCode           string
	StartDate          *time.Time
}

type ProviderSubscription struct {
	SubscriptionCode string
	EmailToken       string
	Status           string
	NextPaymentAt    *time.Time
}

type ProviderSubscriptionUpdate struct {
	ProviderSubscriptionId string
	ProviderCustomerId     string
	PlanCode               string
	EmailToken             string
	Status                 string
	TrialEndsAt            *time.Time
	CurrentPeriodEndsAt    *time.Time
	CancellationReason     string
	Metadata               map[string]string
}

type SubscriptionProvider interface {
	CreateRecurringPlan(ctx context.Context, request RecurringPlanRequest) (string, error)
	CreateSubscription(ctx context.Context, request SubscriptionRequest) (ProviderSubscription, error)
	DisableSubscription(ctx context.Context, subscriptionCode, emailToken string) error
}

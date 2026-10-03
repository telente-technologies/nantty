package models

import (
	"context"
	"database/sql"
	"time"
)

type BillingSubscriptionChange struct {
	BillingSubscriptionId  string
	Reference              string
	ProviderSubscriptionId string
	ProviderObjectId       string
	PlanCode               string
	OwnerUserId            string
	EventType              string
	Status                 string
	TrialEndsAt            *time.Time
	CurrentPeriodEndsAt    *time.Time
	OccurredAt             time.Time
	Metadata               map[string]string
}

type BillingSubscriptionObserver interface {
	HandleBillingSubscriptionChanged(ctx context.Context, transaction *sql.Tx, change BillingSubscriptionChange) error
}

type SavedCardFingerprint struct {
	OwnerUserId        string
	FingerprintHash    string
	CardLabel          string
	SavedAt            time.Time
	Purpose            string
	SubjectId          string
	ProviderCustomerId string
	SetupReference     string
}

type SavedCardObserver interface {
	HandleSavedCardFingerprint(ctx context.Context, transaction *sql.Tx, card SavedCardFingerprint) error
}

type StoreSubscriptionNotice struct {
	Store                 string
	Kind                  string
	StoreTransactionId    string
	OriginalTransactionId string
	ProductId             string
	ExpiresAt             *time.Time
	OccurredAt            time.Time
}

type StoreSubscriptionNotificationHandler interface {
	HandleStoreSubscriptionNotice(ctx context.Context, transaction *sql.Tx, notice StoreSubscriptionNotice) error
}

type SubscriptionCheckoutStart struct {
	OwnerUserId    string
	PlanCode       string
	ProviderPlanId string
	AmountMinor    int64
	Currency       string
	ReturnTo       string
	ClientPlatform string
	Metadata       map[string]string
}

type StartedSubscriptionCheckout struct {
	Reference   string `json:"reference"`
	PlanCode    string `json:"planCode"`
	CheckoutUrl string `json:"checkoutUrl"`
}

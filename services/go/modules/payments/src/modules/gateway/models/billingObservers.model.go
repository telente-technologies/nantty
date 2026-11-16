package models

import (
	"context"
	"database/sql"
	"time"

	"nantty/modules/payments/src/interfaces"
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
	OwnerUserId            string
	FingerprintHash        string
	CardLabel              string
	SavedAt                time.Time
	Purpose                string
	SubjectId              string
	ProviderCustomerId     string
	SetupReference         string
	BillingAuthorizationId string
	CardExpiryMonth        int
	CardExpiryYear         int
}

type SavedCardObserver interface {
	HandleSavedCardFingerprint(ctx context.Context, transaction *sql.Tx, card SavedCardFingerprint) error
}

type BillingAuthorizationRevoked struct {
	OwnerUserId     string
	AuthorizationId string
	Reason          string
	RevokedAt       time.Time
}

type BillingAuthorizationRevokedObserver interface {
	HandleBillingAuthorizationRevoked(ctx context.Context, transaction *sql.Tx, revoked BillingAuthorizationRevoked) error
}

type StoreSubscriptionNotice struct {
	Store                 string
	Kind                  string
	StoreTransactionId    string
	OriginalTransactionId string
	ProductId             string
	ExpiresAt             *time.Time
	OccurredAt            time.Time
	AccountToken          string
	Transaction           *interfaces.VerifiedStorePurchase
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

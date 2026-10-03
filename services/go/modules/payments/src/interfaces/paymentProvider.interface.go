package interfaces

import (
	"context"
	"errors"
	"net/http"
	"time"
)

type ProviderOutcome string

const (
	OutcomePending   ProviderOutcome = "pending"
	OutcomeSucceeded ProviderOutcome = "succeeded"
	OutcomeFailed    ProviderOutcome = "failed"
)

type ChargeRequest struct {
	Reference          string
	IdempotencyKey     string
	AmountMinor        int64
	Currency           string
	ConnectedAccountId string
	PlatformFeeMinor   int64
	CustomerEmail      string
	CustomerName       string
	SuccessUrl         string
	CancelUrl          string
	ExpiresInMinutes   int
	Metadata           map[string]string
}

type ChargeSession struct {
	CheckoutUrl        string
	ProviderCheckoutId string
	ExpiresAt          *time.Time
}

type ChargeLookup struct {
	Reference          string
	ProviderCheckoutId string
	ConnectedAccountId string
}

type ChargeVerification struct {
	Reference        string
	Outcome          ProviderOutcome
	AmountMinor      int64
	Currency         string
	ProviderChargeId string
	ProviderFeeMinor int64
	PlatformFeeMinor int64
	FailureReason    string
}

type RefundRequest struct {
	ProviderChargeId   string
	ConnectedAccountId string
	RefundReference    string
	IdempotencyKey     string
	AmountMinor        int64
	Currency           string
	FullRefund         bool
	Reason             string
}

type RefundResult struct {
	ProviderRefundId string
	Outcome          ProviderOutcome
	FailureReason    string
}

type Bank struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	CountryCode string `json:"countryCode"`
}

type PaymentProvider interface {
	Name() string
	SupportsCurrency(currency string) bool
	InitializeCharge(ctx context.Context, request ChargeRequest) (ChargeSession, error)
	VerifyCharge(ctx context.Context, lookup ChargeLookup) (ChargeVerification, error)
	RefundCharge(ctx context.Context, request RefundRequest) (RefundResult, error)
	ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error)
	ListBanks(ctx context.Context, countryCode string) ([]Bank, error)
	VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (WebhookNotification, error)
}

type ConnectProvider interface {
	PaymentProvider
	ConnectedAccountProvider
	MoneyMovementProvider
	DisputeProvider
	SubscriptionProvider
	SavedCardProvider
}

type StoreReceipt struct {
	ProductId     string
	ReceiptData   string
	TransactionId string
}

type VerifiedStorePurchase struct {
	StoreTransactionId    string
	OriginalTransactionId string
	ProductId             string
	PriceMinor            int64
	Currency              string
	Environment           string
	PurchasedAt           time.Time
	ExpiresAt             *time.Time
	IsSubscription        bool
}

type StoreNotificationKind string

const (
	StoreNotificationRefund        StoreNotificationKind = "refund"
	StoreNotificationRenewed       StoreNotificationKind = "renewed"
	StoreNotificationExpired       StoreNotificationKind = "expired"
	StoreNotificationRenewalFailed StoreNotificationKind = "renewalFailed"
	StoreNotificationOther         StoreNotificationKind = "other"
)

type StoreRefundNotification struct {
	NotificationId        string
	StoreTransactionId    string
	RefundedAt            time.Time
	Kind                  StoreNotificationKind
	OriginalTransactionId string
	ProductId             string
	ExpiresAt             *time.Time
}

func (notification StoreRefundNotification) IsRefund() bool {
	return notification.Kind == "" || notification.Kind == StoreNotificationRefund
}

type StoreReceiptVerifier interface {
	Store() string
	StoreFeeBasisPoints() int64
	VerifyPurchaseReceipt(ctx context.Context, receipt StoreReceipt) (VerifiedStorePurchase, error)
	VerifySignedRefundNotification(ctx context.Context, rawBody []byte, headers http.Header) (StoreRefundNotification, error)
}

var (
	ErrInvalidWebhookSignature        = errors.New("invalid webhook signature")
	ErrStaleWebhookTimestamp          = errors.New("webhook timestamp outside the allowed tolerance")
	ErrMalformedWebhookPayload        = errors.New("malformed webhook payload")
	ErrProviderUnavailable            = errors.New("payment provider unavailable")
	ErrProviderNotConfigured          = errors.New("payment provider is not configured")
	ErrCurrencyNotSupported           = errors.New("currency not supported by provider")
	ErrBankAccountNotFound            = errors.New("bank account not found")
	ErrInsufficientProviderBalance    = errors.New("provider balance is too low for this movement")
	ErrConnectedAccountInDebt         = errors.New("connected account has a negative provider balance")
	ErrStoreVerificationNotConfigured = errors.New("store receipt verification is not configured")
	ErrStoreReceiptInvalid            = errors.New("store receipt could not be verified")
)

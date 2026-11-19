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
	AmountMinor        int64
	Currency           string
	CustomerEmail      string
	CustomerLabel      string
	SuccessUrl         string
	Channels           []string
	SettlementAccount  string
	PlatformShareMinor int64
	SubaccountBearsFee bool
	PlanCode           string
	ExpiresInMinutes   int
	Metadata           map[string]string
	SplitShares        []SplitShare
}

type SplitShare struct {
	Subaccount string
	ShareMinor int64
}

type ChargeSession struct {
	CheckoutUrl        string
	ProviderCheckoutId string
	ExpiresAt          *time.Time
}

type ChargeLookup struct {
	Reference        string
	ProviderChargeId string
}

type CardAuthorization struct {
	AuthorizationCode string
	Signature         string
	Brand             string
	Last4             string
	ExpiryMonth       int
	ExpiryYear        int
	Reusable          bool
	Channel           string
}

type ChargeVerification struct {
	Reference          string
	Outcome            ProviderOutcome
	AmountMinor        int64
	Currency           string
	ProviderChargeId   string
	ProviderFeeMinor   int64
	SettlementAccount  string
	ProviderCustomerId string
	PlanCode           string
	Channel            string
	FailureReason      string
	CustomerEmail      string
	Authorization      *CardAuthorization
}

type RefundRequest struct {
	ProviderChargeId string
	ChargeReference  string
	RefundReference  string
	AmountMinor      int64
	Currency         string
	FullRefund       bool
	Reason           string
}

type RefundResult struct {
	ProviderRefundId    string
	Outcome             ProviderOutcome
	NeedsCustomerDetail bool
	FailureReason       string
}

type Bank struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	CountryCode string `json:"countryCode"`
	ProviderID  int64  `json:"-"`
}

type BankBranch struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type BankBranchDirectory interface {
	ListBankBranches(ctx context.Context, countryCode, bankCode string) ([]BankBranch, error)
}

type PaymentProvider interface {
	Name() string
	SupportsCurrency(currency string) bool
	InitializeCharge(ctx context.Context, request ChargeRequest) (ChargeSession, error)
	VerifyCharge(ctx context.Context, lookup ChargeLookup) (ChargeVerification, error)
	RefundCharge(ctx context.Context, request RefundRequest) (RefundResult, error)
	VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (WebhookNotification, error)
	ParseVerifiedWebhookPayload(rawBody []byte) (WebhookNotification, error)
}

type RefundBankDetailsProvider interface {
	RetryRefundWithCustomerBankAccount(ctx context.Context, providerRefundId string, account PayeeBankAccount) error
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
	AccountToken          string
	NeedsAcknowledgement  bool
}

type StoreNotificationKind string

const (
	StoreNotificationRefund        StoreNotificationKind = "refund"
	StoreNotificationRenewed       StoreNotificationKind = "renewed"
	StoreNotificationExpired       StoreNotificationKind = "expired"
	StoreNotificationRenewalFailed StoreNotificationKind = "renewalFailed"
	StoreNotificationGrace         StoreNotificationKind = "grace"
	StoreNotificationCancelled     StoreNotificationKind = "cancelled"
	StoreNotificationResumed       StoreNotificationKind = "resumed"
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
	AccountToken          string
	Transaction           *VerifiedStorePurchase
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

type StoreSubscriptionAcknowledger interface {
	AcknowledgeSubscription(ctx context.Context, productId, purchaseToken string) error
}

var (
	ErrInvalidWebhookSignature        = errors.New("invalid webhook signature")
	ErrMalformedWebhookPayload        = errors.New("malformed webhook payload")
	ErrProviderUnavailable            = errors.New("payment provider unavailable")
	ErrProviderNotConfigured          = errors.New("payment provider is not configured")
	ErrCurrencyNotSupported           = errors.New("currency not supported by provider")
	ErrBankAccountNotFound            = errors.New("bank account not found")
	ErrInsufficientProviderBalance    = errors.New("provider balance is too low for this movement")
	ErrTransferNeedsOtp               = errors.New("the provider asked for an OTP to finalize the transfer")
	ErrStoreVerificationNotConfigured = errors.New("store receipt verification is not configured")
	ErrStoreReceiptInvalid            = errors.New("store receipt could not be verified")
	ErrSavedCardNotForCustomer        = errors.New("the saved card cannot be charged for this account")
	ErrCapabilityNotSupported         = errors.New("the payment provider does not support this operation")
)

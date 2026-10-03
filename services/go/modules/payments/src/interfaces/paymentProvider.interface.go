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
	Reference   string
	AmountMinor int64
	Currency    string
	Email       string
	CallbackUrl string
	Metadata    map[string]string
}

type ChargeSession struct {
	AuthorizationUrl string
}

type ChargeVerification struct {
	Reference             string
	Outcome               ProviderOutcome
	AmountMinor           int64
	Currency              string
	ProviderTransactionId string
	ProviderFeeMinor      int64
	FailureReason         string
}

type RefundRequest struct {
	PaymentReference      string
	ProviderTransactionId string
	RefundReference       string
	AmountMinor           int64
	Currency              string
}

type RefundResult struct {
	ProviderRefundId string
	Outcome          ProviderOutcome
	FailureReason    string
}

type TransferRequest struct {
	Reference     string
	AmountMinor   int64
	Currency      string
	BankCode      string
	AccountNumber string
	AccountName   string
	Narration     string
}

type TransferLookup struct {
	Reference            string
	ProviderTransferCode string
}

type TransferResult struct {
	ProviderTransferCode string
	Outcome              ProviderOutcome
	FailureReason        string
}

type Bank struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	CountryCode string `json:"countryCode"`
}

type WebhookKind string

const (
	WebhookKindCharge   WebhookKind = "charge"
	WebhookKindTransfer WebhookKind = "transfer"
	WebhookKindRefund   WebhookKind = "refund"
	WebhookKindOther    WebhookKind = "other"
)

type WebhookNotification struct {
	EventKey             string
	EventType            string
	Kind                 WebhookKind
	Reference            string
	ProviderTransferCode string
}

type SettledCharge struct {
	Reference   string
	AmountMinor int64
	Currency    string
}

type PaymentProvider interface {
	Name() string
	SupportsCurrency(currency string) bool
	InitializeCharge(ctx context.Context, request ChargeRequest) (ChargeSession, error)
	VerifyCharge(ctx context.Context, reference string) (ChargeVerification, error)
	RefundCharge(ctx context.Context, request RefundRequest) (RefundResult, error)
	InitiateTransfer(ctx context.Context, request TransferRequest) (TransferResult, error)
	VerifyTransfer(ctx context.Context, lookup TransferLookup) (TransferResult, error)
	QuoteTransferFee(currency string, amountMinor int64) (int64, error)
	ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error)
	ListBanks(ctx context.Context, countryCode string) ([]Bank, error)
	VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (WebhookNotification, error)
	ListSettledCharges(ctx context.Context, from, to time.Time) ([]SettledCharge, error)
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
}

type StoreRefundNotification struct {
	NotificationId     string
	StoreTransactionId string
	RefundedAt         time.Time
}

type StoreReceiptVerifier interface {
	Store() string
	StoreFeeBasisPoints() int64
	VerifyPurchaseReceipt(ctx context.Context, receipt StoreReceipt) (VerifiedStorePurchase, error)
	VerifySignedRefundNotification(ctx context.Context, rawBody []byte, headers http.Header) (StoreRefundNotification, error)
}

var (
	ErrInvalidWebhookSignature        = errors.New("invalid webhook signature")
	ErrMalformedWebhookPayload        = errors.New("malformed webhook payload")
	ErrProviderUnavailable            = errors.New("payment provider unavailable")
	ErrProviderNotConfigured          = errors.New("payment provider is not configured")
	ErrCurrencyNotSupported           = errors.New("currency not supported by provider")
	ErrBankAccountNotFound            = errors.New("bank account not found")
	ErrStoreVerificationNotConfigured = errors.New("store receipt verification is not configured")
	ErrStoreReceiptInvalid            = errors.New("store receipt could not be verified")
)

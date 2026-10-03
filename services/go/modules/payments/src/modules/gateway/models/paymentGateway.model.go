package models

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type OrderPayable struct {
	CheckoutId     string `json:"checkoutId"`
	OrderId        string `json:"orderId"`
	OrderReference string `json:"orderReference"`
	BuyerUserId    string `json:"buyerUserId"`
	StoreId        string `json:"storeId"`
	SellerUserId   string `json:"sellerUserId"`
	AmountMinor    int64  `json:"amountMinor"`
	Currency       string `json:"currency"`
	ProductSummary string `json:"productSummary"`
	PaymentMode    string `json:"paymentMode"`
	StoreVerified  bool   `json:"storeVerified"`
}

type SettledPayment struct {
	IntentId              uuid.UUID
	Reference             string
	Purpose               string
	OwnerUserId           string
	SubjectId             string
	Provider              string
	AmountMinor           int64
	AppliedAmountMinor    int64
	Currency              string
	ConnectedAccountId    string
	BeneficiaryUserId     string
	PlatformFeeMinor      int64
	ProviderFeeMinor      int64
	ProviderTransactionId string
	ProviderCustomerId    string
	FailureReason         string
	SettledAt             time.Time
	OrderPayables         []OrderPayable
	Authorization         *CardAuthorizationHandoff
}

type CardAuthorizationHandoff struct {
	AuthorizationCode string
	Signature         string
	Brand             string
	Last4             string
	ExpiryMonth       int
	ExpiryYear        int
	Reusable          bool
}

type PaymentPurposeHandler interface {
	HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment SettledPayment) error
	HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment SettledPayment) error
}

type FinishedTransfer struct {
	TransferId           uuid.UUID
	Kind                 string
	Reference            string
	Purpose              string
	SubjectId            string
	Provider             string
	BeneficiaryUserId    string
	AmountMinor          int64
	FeeMinor             int64
	Currency             string
	ProviderTransferCode string
	FailureReason        string
	FinishedAt           time.Time
}

type TransferOutcomeHandler interface {
	HandleTransferSucceeded(ctx context.Context, transaction *sql.Tx, transfer FinishedTransfer) error
	HandleTransferFailed(ctx context.Context, transaction *sql.Tx, transfer FinishedTransfer) error
}

type RefundedStorePurchase struct {
	Store              string
	StoreTransactionId string
	UserId             string
	Purpose            string
	SubjectId          string
	PriceMinor         int64
	Currency           string
	RefundedAt         time.Time
}

type StoreRefundHandler interface {
	HandleStorePurchaseRefunded(ctx context.Context, transaction *sql.Tx, purchase RefundedStorePurchase) error
}

type PaymentIntentView struct {
	Id               uuid.UUID  `json:"id"`
	Reference        string     `json:"reference"`
	Purpose          string     `json:"purpose"`
	SubjectId        string     `json:"subjectId"`
	Provider         string     `json:"provider"`
	Amount           MoneyView  `json:"amount"`
	Status           string     `json:"status"`
	CheckoutUrl      *string    `json:"checkoutUrl"`
	AuthorizationUrl *string    `json:"authorizationUrl"`
	CallbackUrl      string     `json:"callbackUrl,omitempty"`
	RefundedAmount   MoneyView  `json:"refundedAmount"`
	PaidAt           *time.Time `json:"paidAt"`
	CreatedAt        time.Time  `json:"createdAt"`
}

type MoneyView struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type CreatePaymentIntentRequest struct {
	Purpose           string
	OwnerUserId       string
	SubjectId         string
	Provider          string
	AmountMinor       int64
	Currency          string
	BeneficiaryUserId string
	PlatformFeeMinor  int64
	ReturnTo          string
	Metadata          map[string]string

	SettleToSellerSubaccount bool
}

type RefundRequest struct {
	PaymentIntentId uuid.UUID
	AmountMinor     int64
	Currency        string
	Reference       string
	Reason          string
}

type SellerPayoutInstruction struct {
	Purpose           string
	SubjectId         string
	BeneficiaryUserId string
	Reference         string
	AmountMinor       int64
	FeeMinor          int64
	Currency          string
	BankCode          string
	AccountNumber     string
}

type PlatformTransferInstruction struct {
	Purpose           string
	SubjectId         string
	BeneficiaryUserId string
	Reference         string
	AmountMinor       int64
	Currency          string
	TransferGroup     string
	Description       string
}

type ProviderDisputeNotice struct {
	PaymentIntentId   uuid.UUID
	Purpose           string
	SubjectId         string
	BeneficiaryUserId string
	ProviderDisputeId string
	Status            string
	Reason            string
	AmountMinor       int64
	Currency          string
	Opened            bool
	OccurredAt        time.Time
}

type ProviderDisputeHandler interface {
	HandleProviderDispute(ctx context.Context, transaction *sql.Tx, notice ProviderDisputeNotice) error
}

type VerifiedStorePurchaseRecord struct {
	Store                 string
	StoreTransactionId    string
	OriginalTransactionId string
	ProductId             string
	PriceMinor            int64
	Currency              string
	StoreFeeMinor         int64
	Environment           string
	Replayed              bool
}

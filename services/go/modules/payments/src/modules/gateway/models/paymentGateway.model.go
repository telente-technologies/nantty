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
}

type SettledPayment struct {
	IntentId              uuid.UUID
	Reference             string
	Purpose               string
	OwnerUserId           string
	SubjectId             string
	Provider              string
	AmountMinor           int64
	Currency              string
	ProviderFeeMinor      int64
	ProviderTransactionId string
	FailureReason         string
	SettledAt             time.Time
	OrderPayables         []OrderPayable
}

type PaymentPurposeHandler interface {
	HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment SettledPayment) error
	HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment SettledPayment) error
}

type FinishedTransfer struct {
	TransferId           uuid.UUID
	Reference            string
	Purpose              string
	SubjectId            string
	Provider             string
	AmountMinor          int64
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
	Purpose     string
	OwnerUserId string
	SubjectId   string
	Provider    string
	AmountMinor int64
	Currency    string
	Email       string
	ReturnTo    string
	Metadata    map[string]string
}

type RefundRequest struct {
	PaymentIntentId uuid.UUID
	AmountMinor     int64
	Currency        string
	Reference       string
	Reason          string
}

type PayoutTransferInstruction struct {
	Purpose       string
	SubjectId     string
	Provider      string
	Reference     string
	AmountMinor   int64
	Currency      string
	BankCode      string
	AccountNumber string
	AccountName   string
	Narration     string
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

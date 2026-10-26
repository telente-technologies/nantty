package paymentstesting

import (
	"net/http"

	"nantty/modules/payments/src/interfaces"
)

type FakeWriteKind string

const (
	FakeWriteCharge   FakeWriteKind = "charge"
	FakeWriteRefund   FakeWriteKind = "refund"
	FakeWriteTransfer FakeWriteKind = "transfer"
)

type FakeProviderServer interface {
	ProviderName() string
	BaseUrl() string
	NewAdapter() interfaces.PaymentProvider
	SettleCheckout(reference string, paidAmountMinor, feeMinor int64) bool
	SetPayoutOutcome(reference string, outcome interfaces.ProviderOutcome) bool
	LoseNextWriteReply(kind FakeWriteKind)
	SignWebhook(event string, data map[string]any) ([]byte, http.Header)
	CallCount(pattern string) int
}

type FakeWalletServer interface {
	FakeProviderServer
	FundWallet(accountRef, currency string, amountMinor int64, fundingReference string)
	WalletBalance(accountRef, currency string) int64
	DebitWalletOutsideLedger(accountRef, currency string, amountMinor int64)
}

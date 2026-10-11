package paymentstesting

import (
	"net/http"
	"strings"

	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
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

var _ FakeProviderServer = (*FakePaystack)(nil)

func (fake *FakePaystack) ProviderName() string { return integrations.PaystackProviderName }

func (fake *FakePaystack) BaseUrl() string { return fake.Server.URL }

func (fake *FakePaystack) NewAdapter() interfaces.PaymentProvider {
	return integrations.NewPaystackProvider(integrations.PaystackSettings{BaseUrl: fake.Server.URL, SecretKey: FakePaystackSecretKey, MaximumAttempts: 3})
}

func (fake *FakePaystack) SettleCheckout(reference string, paidAmountMinor, feeMinor int64) bool {
	return fake.CompleteCheckout(reference, paidAmountMinor, feeMinor, "card") != nil
}

func (fake *FakePaystack) SetPayoutOutcome(reference string, outcome interfaces.ProviderOutcome) bool {
	status := map[interfaces.ProviderOutcome]string{interfaces.OutcomeSucceeded: "success", interfaces.OutcomeFailed: "failed", interfaces.OutcomePending: "pending"}[outcome]
	return fake.SetTransferStatus(strings.ToLower(reference), status) != nil
}

func (fake *FakePaystack) LoseNextWriteReply(kind FakeWriteKind) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	switch kind {
	case FakeWriteCharge:
		fake.LoseNextChargeReply = true
	case FakeWriteRefund:
		fake.LoseNextRefundReply = true
	case FakeWriteTransfer:
		fake.LoseNextTransferReply = true
	}
}

func (fake *FakePaystack) SignWebhook(event string, data map[string]any) ([]byte, http.Header) {
	return SignedPaystackWebhook(event, data)
}

func (fake *FakePaystack) CallCount(pattern string) int { return fake.Calls(pattern) }

package paymentstesting

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/interfaces"
)

var _ FakeWalletServer = (*FakeFlutterwave)(nil)

func (fake *FakeFlutterwave) WalletRefByNuban(nuban string) string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, wallet := range fake.Wallets {
		if containsString(wallet.FundingNumbers, nuban) {
			return wallet.Ref
		}
	}
	return ""
}

func (fake *FakeFlutterwave) SmokeStateJSON() []byte {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	state, _ := json.Marshal(map[string]any{
		"transactions": len(fake.Transactions), "transfers": fake.Transfers, "refunds": fake.Refunds,
		"mainBalance": fake.MainBalance, "requests": fake.Requests,
	})
	return state
}

func (fake *FakeFlutterwave) ProviderName() string { return integrations.FlutterwaveProviderName }

func (fake *FakeFlutterwave) BaseUrl() string { return fake.Server.URL + "/v3" }

func (fake *FakeFlutterwave) Settings() integrations.FlutterwaveSettings {
	return integrations.FlutterwaveSettings{
		BaseUrl: fake.BaseUrl(), SecretKey: FakeFlutterwaveSecretKey, WebhookHash: FakeFlutterwaveWebhookHash, MerchantId: FakeFlutterwaveMerchantId,
		MaximumAttempts: 3, RenewalRedirectUrl: "https://nantty.test/pay/return", CheckoutTitle: "Nantty",
	}
}

func (fake *FakeFlutterwave) NewAdapter() interfaces.PaymentProvider {
	return integrations.NewFlutterwaveProvider(fake.Settings())
}

func (fake *FakeFlutterwave) SettleCheckout(reference string, paidAmountMinor, feeMinor int64) bool {
	return fake.CompleteCheckout(reference, paidAmountMinor, feeMinor, "card") != nil
}

func (fake *FakeFlutterwave) SetPayoutOutcome(reference string, outcome interfaces.ProviderOutcome) bool {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	transfer := fake.Transfers[reference]
	if transfer == nil {
		return false
	}
	switch outcome {
	case interfaces.OutcomeSucceeded:
		transfer.Status = "SUCCESSFUL"
	case interfaces.OutcomeFailed:
		if transfer.Status != "FAILED" {
			fake.refundTransferSource(transfer)
		}
		transfer.Status, transfer.CompleteMessage = "FAILED", "Account resolve failed"
	default:
		transfer.Status = "PENDING"
	}
	return true
}

func (fake *FakeFlutterwave) TransferWebhook(reference string) ([]byte, http.Header) {
	fake.mutex.Lock()
	transfer := fake.Transfers[reference]
	data := map[string]any{}
	if transfer != nil {
		data = fake.transferJson(transfer)
	}
	fake.mutex.Unlock()
	return SignedFlutterwaveWebhook("transfer.completed", data)
}

func (fake *FakeFlutterwave) LoseNextWriteReply(kind FakeWriteKind) {
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

func (fake *FakeFlutterwave) SignWebhook(event string, data map[string]any) ([]byte, http.Header) {
	return SignedFlutterwaveWebhook(event, data)
}

func (fake *FakeFlutterwave) CallCount(pattern string) int { return fake.Calls(pattern) }

func (fake *FakeFlutterwave) FundWallet(accountRef, currency string, amountMinor int64, fundingReference string) {
	fake.FundWalletAndSignWebhook(accountRef, amountMinor, fundingReference, 0)
}

func (fake *FakeFlutterwave) FundWalletAndSignWebhook(accountRef string, amountMinor int64, fundingReference string, webhookAmountOverride int64) ([]byte, http.Header) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	wallet := fake.Wallets[accountRef]
	if wallet == nil {
		return nil, nil
	}
	if fundingReference == "" {
		fundingReference = fmt.Sprintf("PSA_%d", fake.newId())
	}
	wallet.BalanceMinor += amountMinor - fake.FundingFeeMinor
	fake.walletLine(wallet, "C", fundingReference, amountMinor, "WALLET FUNDING")
	if fake.FundingFeeMinor > 0 {
		fake.walletLine(wallet, "D", fundingReference+"_FEE", fake.FundingFeeMinor, "WALLET FUNDING FEE")
	}
	hinted := amountMinor
	if webhookAmountOverride > 0 {
		hinted = webhookAmountOverride
	}
	return SignedFlutterwaveWebhook("transfer.completed", map[string]any{
		"id": fake.newId(), "account_number": wallet.Nuban, "bank_code": "090567", "fullname": wallet.Name, "currency": "NGN", "debit_currency": "PSA",
		"amount": fakeMajor(hinted, "NGN"), "fee": fakeMajor(fake.FundingFeeMinor, "NGN"), "status": "SUCCESSFUL", "reference": fundingReference,
		"narration": "WALLET FUNDING", "complete_message": "Successful", "meta": map[string]any{"sender_account_number": "0123456789", "sender_bank_code": "058"},
	})
}

func (fake *FakeFlutterwave) WalletBalance(accountRef, _ string) int64 {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if wallet := fake.Wallets[accountRef]; wallet != nil {
		return wallet.BalanceMinor
	}
	return 0
}

func (fake *FakeFlutterwave) DebitWalletOutsideLedger(accountRef, _ string, amountMinor int64) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if wallet := fake.Wallets[accountRef]; wallet != nil {
		wallet.BalanceMinor -= amountMinor
		fake.walletLine(wallet, "D", fmt.Sprintf("UNKNOWN_%d", fake.newId()), amountMinor, "DASHBOARD DEBIT")
	}
}

func (fake *FakeFlutterwave) ReverseFundingAtBank(fundingReference string) bool {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	status, _, _ := fake.reverseFunding(map[string]any{"funding_reference": fundingReference})
	return status == http.StatusOK
}

func (fake *FakeFlutterwave) DeleteWalletAtProvider(accountRef string) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if wallet := fake.Wallets[accountRef]; wallet != nil {
		wallet.Status = "DELETED"
	}
}

func (fake *FakeFlutterwave) MainBalanceOf(currency string) int64 {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	return fake.MainBalance[currency]
}

func (fake *FakeFlutterwave) FundMainBalance(currency string, amountMinor int64) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.MainBalance[currency] += amountMinor
}

func (fake *FakeFlutterwave) WalletForEmail(email string) *FakeFlwWallet {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, wallet := range fake.Wallets {
		if strings.EqualFold(wallet.Email, email) {
			copied := *wallet
			return &copied
		}
	}
	return nil
}

func (fake *FakeFlutterwave) TransferByReference(reference string) *FakeFlwTransfer {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if transfer := fake.Transfers[reference]; transfer != nil {
		copied := *transfer
		return &copied
	}
	return nil
}

func (fake *FakeFlutterwave) SetRateLimitedRequests(count int) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.RateLimitNext = count
}

func (fake *FakeFlutterwave) CreditWalletWithoutFee(accountRef string, amountMinor int64, reference string) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	if wallet := fake.Wallets[accountRef]; wallet != nil {
		wallet.BalanceMinor += amountMinor
		fake.walletLine(wallet, "C", reference, amountMinor, "TEST SEED")
	}
}

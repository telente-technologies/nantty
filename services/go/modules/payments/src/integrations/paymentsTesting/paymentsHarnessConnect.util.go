package paymentstesting

import (
	"context"
	"fmt"
	"hash/fnv"
	"net/http"

	"zudomart/modules/payments/src/modules/gateway/services"
)

func (harness *MoneyHarness) OnboardConnectedAccount(userId string, acceptPayments bool) string {
	harness.T.Helper()
	gateway := harness.Payments.Application.Gateway
	role := "creator"
	if acceptPayments {
		role = "seller"
	}
	if err := gateway.SavePayoutOnboardingIdentity(context.Background(), userId, services.OnboardingIdentityInput{
		Role: role, LegalName: "Temitope Adeyemi", DateOfBirth: "1994-02-03", AddressLine1: "4 Allen Avenue", City: "Ikeja", State: "Lagos", IdType: "bvn", IdNumber: "22212345678",
	}); err != nil {
		harness.T.Fatalf("identity for %s: %v", userId, err)
	}
	if err := gateway.SavePayoutOnboardingBank(context.Background(), userId, services.OnboardingBankInput{BankCode: "058", BankName: "Guaranty Trust Bank", AccountNumber: TestBankAccountNumberFor(userId)}); err != nil {
		harness.T.Fatalf("bank for %s: %v", userId, err)
	}
	gateway.ProcessDueConnectedAccountJobs(context.Background(), 20)
	account, err := gateway.FindConnectedAccountForUser(context.Background(), harness.Database, userId)
	if err != nil {
		harness.T.Fatalf("payout account for %s was not created by the worker: %v", userId, err)
	}
	if acceptPayments {
		return account.SettlementSubaccountCode
	}
	return account.RecipientCode
}

func (harness *MoneyHarness) DeliverPaystackEvent(event string, data map[string]any) HarnessResponse {
	harness.T.Helper()
	body, headers := SignedPaystackWebhook(event, data)
	response := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body, headers)
	if response.Status != http.StatusOK {
		harness.T.Fatalf("%s webhook: %d %s", event, response.Status, response.Raw)
	}
	return response
}

func (harness *MoneyHarness) PayCheckout(reference string, feeMinor int64, channel string) *FakeTransaction {
	harness.T.Helper()
	transaction := harness.Paystack.CompleteCheckout(reference, 0, feeMinor, channel)
	if transaction == nil {
		harness.T.Fatalf("no checkout for %s", reference)
	}
	harness.DeliverPaystackEvent("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": transaction.Currency})
	return transaction
}

func (harness *MoneyHarness) CompleteCheckoutThroughWebhook(reference string, paidAmountOverride, feeMinor int64) *FakeTransaction {
	harness.T.Helper()
	transaction := harness.Paystack.CompleteCheckout(reference, paidAmountOverride, feeMinor, "card")
	if transaction == nil {
		harness.T.Fatalf("no checkout for %s", reference)
	}
	harness.DeliverPaystackEvent("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": transaction.AmountMinor, "currency": transaction.Currency})
	return transaction
}

func TestBankAccountNumberFor(userId string) string {
	digest := fnv.New32a()
	_, _ = digest.Write([]byte(userId))
	return fmt.Sprintf("2%09d", digest.Sum32()%1_000_000_000)
}

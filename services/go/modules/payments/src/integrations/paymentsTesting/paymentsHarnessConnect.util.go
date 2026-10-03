package paymentstesting

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

var webhookEventCounter atomic.Int64

func (harness *MoneyHarness) OnboardConnectedAccount(userId string, acceptPayments bool) string {
	harness.T.Helper()
	gateway := harness.Payments.Application.Gateway
	account, err := gateway.EnsureConnectedAccountForUser(context.Background(), userId, acceptPayments)
	if err != nil {
		harness.T.Fatalf("connected account for %s: %v", userId, err)
	}
	harness.Bachs.ActivateAllCapabilities(account.ProviderAccountID)
	body, headers := SignedBachsWebhook(harness.NextEventId(), "capability.updated", account.ProviderAccountID, map[string]any{"account": account.ProviderAccountID, "capability": "payouts", "status": "active", "requested": true}, time.Now())
	if response := harness.Call(http.MethodPost, "/webhooks/bachs", "", "", body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("capability webhook: %d %s", response.Status, response.Raw)
	}
	return account.ProviderAccountID
}

func (harness *MoneyHarness) NextEventId() string {
	return fmt.Sprintf("evt_test_%d_%d", time.Now().UnixNano(), webhookEventCounter.Add(1))
}

func (harness *MoneyHarness) DeliverBachsEvent(eventType, connectedAccountId string, data map[string]any) HarnessResponse {
	harness.T.Helper()
	body, headers := SignedBachsWebhook(harness.NextEventId(), eventType, connectedAccountId, data, time.Now())
	response := harness.Call(http.MethodPost, "/webhooks/bachs", "", "", body, headers)
	if response.Status != http.StatusOK {
		harness.T.Fatalf("%s webhook: %d %s", eventType, response.Status, response.Raw)
	}
	return response
}

func (harness *MoneyHarness) CompleteCheckoutThroughWebhook(reference string, paidAmountOverride, processingFee int64) {
	harness.T.Helper()
	checkout := harness.Bachs.CompleteCheckout(reference, paidAmountOverride, processingFee)
	if checkout == nil {
		harness.T.Fatalf("no checkout for %s", reference)
	}
	harness.DeliverBachsEvent("collection.succeeded", checkout.AccountId, map[string]any{
		"charge_id": checkout.ChargeId, "checkout_id": checkout.Id, "reference": reference, "status": "SUCCEEDED",
		"amount": decimal(checkout.AmountMinor, checkout.Currency), "currency": checkout.Currency,
		"processing_fee": decimal(processingFee, checkout.Currency), "fee_bearer": "merchant", "metadata": map[string]any{},
	})
}

func (harness *MoneyHarness) AssertProviderMirrorMatches() {
	harness.T.Helper()
	report, err := harness.Payments.Application.Gateway.ReconcileProviderMirror(context.Background())
	if err != nil {
		harness.T.Fatal(err)
	}
	if len(report.Mismatches) != 0 {
		harness.T.Fatalf("ledger mirror disagrees with provider balances: %+v", report.Mismatches)
	}
}

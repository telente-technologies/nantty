package escrow

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentstesting "zudomart/modules/payments/src/integrations/paymentsTesting"
)

func TestCheckoutPaymentIsHeldInEscrowOnceAndReleasedAfterInspection(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, firstOrder, secondOrder := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{firstOrder: 600_000, secondOrder: 400_000})
	token := harness.Tokens.UserAccessToken(buyer)

	first := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "checkout-key-1", map[string]any{"orderId": firstOrder, "provider": "paystack"})
	replay := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "checkout-key-1", map[string]any{"orderId": firstOrder, "provider": "paystack"})
	reused := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "checkout-key-1", map[string]any{"orderId": secondOrder, "provider": "paystack"})
	if first.Status != http.StatusCreated || replay.Body["reference"] != first.Body["reference"] || replay.Headers.Get("Idempotent-Replayed") != "true" || reused.Status != http.StatusConflict {
		t.Fatalf("initialize idempotency broken: %d %v / %v %v / %d", first.Status, first.Body, replay.Body, replay.Headers, reused.Status)
	}
	if amount := first.Body["payment"].(map[string]any)["amount"].(map[string]any)["amountMinor"].(float64); amount != 1_000_000 {
		t.Fatalf("checkout total = %v", amount)
	}
	if missingKey := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "", map[string]any{"orderId": firstOrder, "provider": "paystack"}); missingKey.Status != http.StatusBadRequest {
		t.Fatalf("missing key accepted: %d", missingKey.Status)
	}
	if stranger := harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(uuid.NewString()), "stranger-key", map[string]any{"orderId": firstOrder, "provider": "paystack"}); stranger.Status != http.StatusNotFound {
		t.Fatalf("another user initialized the buyer's order: %d", stranger.Status)
	}
	if pending := harness.Call(http.MethodPost, "/api/v1/payments/orders/"+firstOrder+"/verify", token, "", nil); pending.Body["status"] != "pending" {
		t.Fatalf("expected pending, got %v", pending.Body)
	}

	reference := first.Body["reference"].(string)
	harness.Paystack.MarkChargeAs(reference, "success", 0, 150)
	body, headers := paymentstesting.SignedPaystackWebhook("charge.success", map[string]any{"id": harness.Paystack.ChargeId(reference), "reference": reference})
	forged, _ := paymentstesting.SignedPaystackWebhook("charge.success", map[string]any{"id": 1, "reference": reference})
	if response := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", forged, http.Header{"X-Paystack-Signature": {"deadbeef"}}); response.Status != http.StatusUnauthorized {
		t.Fatalf("forged webhook accepted: %d", response.Status)
	}
	var group sync.WaitGroup
	for range 5 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/paystack", "", "", body, headers); response.Status != http.StatusOK {
				t.Errorf("webhook delivery: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if duplicate := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body, headers); duplicate.Body["duplicate"] != true {
		t.Fatalf("replayed webhook not reported as duplicate: %v", duplicate.Body)
	}
	if paid := harness.Call(http.MethodPost, "/api/v1/payments/orders/"+secondOrder+"/verify", token, "", nil); paid.Body["status"] != "paid" {
		t.Fatalf("expected paid, got %v", paid.Body)
	}
	if harness.balance(ledgermodels.ProviderClearingAccount("paystack", "NGN")) != 1_000_000-150 || harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")) != 0 {
		t.Fatalf("collection not booked exactly once")
	}

	escrowView := harness.Call(http.MethodGet, "/api/v1/orders/"+firstOrder+"/escrow", token, "", nil)
	if escrowView.Status != http.StatusOK || escrowView.Body["stage"] != "seller_preparing" || escrowView.Body["platformFee"].(map[string]any)["amountMinor"].(float64) != 30_000 {
		t.Fatalf("escrow view: %d %v", escrowView.Status, escrowView.Body)
	}
	if hidden := harness.Call(http.MethodGet, "/api/v1/orders/"+firstOrder+"/escrow", harness.Tokens.UserAccessToken(uuid.NewString()), "", nil); hidden.Status != http.StatusNotFound {
		t.Fatalf("escrow visible to a stranger: %d", hidden.Status)
	}

	escrows := harness.escrow.Application.Escrows
	deliveredAt := harness.clock.Add(-time.Hour)
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: firstOrder, Stage: "delivered", OccurredAt: deliveredAt})
		return err
	})
	if released, _ := escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("escrow released before the inspection period ended")
	}
	harness.clock = harness.clock.Add(72 * time.Hour)
	if released, err := escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); err != nil || released != 1 {
		t.Fatalf("auto-release released %d: %v", released, err)
	}
	sellerId := "seller-" + firstOrder[:4]
	if harness.balance(ledgermodels.SellerPendingAccount(sellerId, "NGN")) != 570_000 || harness.balance(ledgermodels.SellerAvailableAccount(sellerId, "NGN")) != 0 || harness.balance(ledgermodels.PlatformCommissionRevenueAccount("NGN")) != 30_000 {
		t.Fatal("release did not lock 95% for the seller and book 5% commission")
	}
	harness.clock = harness.clock.Add(25 * time.Hour)
	if matured, err := harness.escrow.Application.Container.Sellers.MatureDueCredits(context.Background(), harness.Database, 10); err != nil || matured != 1 {
		t.Fatalf("matured %d: %v", matured, err)
	}
	if harness.balance(ledgermodels.SellerAvailableAccount(sellerId, "NGN")) != 570_000 || harness.balance(ledgermodels.SellerPendingAccount(sellerId, "NGN")) != 0 {
		t.Fatal("matured credit did not become available")
	}
	if holds := harness.Call(http.MethodGet, "/api/v1/wallets/me/escrow-holds", harness.Tokens.UserAccessToken("seller-"+secondOrder[:4]), "", nil); len(holds.Body["data"].([]any)) != 1 {
		t.Fatalf("seller holds: %v", holds.Body)
	}
	harness.AssertLedgerHealthy()
}

func TestDisputeFreezesEscrowAndPartialResolutionRefundsThroughTheProvider(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 1_000_000})
	harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	token := harness.Tokens.UserAccessToken(buyer)
	seller := harness.Tokens.UserAccessToken("seller-" + orderId[:4])

	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", token, "dispute-key-1", map[string]any{"reason": "damaged", "description": "Torn on arrival", "evidenceUrls": []string{"https://cdn.zudomart.test/a.jpg"}})
	if opened.Status != http.StatusCreated || opened.Body["status"] != "awaiting_seller" || len(opened.Body["statusHistory"].([]any)) != 2 {
		t.Fatalf("open dispute: %d %v", opened.Status, opened.Body)
	}
	disputeId := opened.Body["id"].(string)
	if sellerCannotOpen := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", seller, "dispute-key-2", map[string]any{"reason": "other", "description": "", "evidenceUrls": []string{}}); sellerCannotOpen.Status != http.StatusNotFound {
		t.Fatalf("seller opened a dispute: %d", sellerCannotOpen.Status)
	}
	mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.RecordOrderFulfilmentInTransaction(ctx, transaction, escrowservices.OrderFulfilment{OrderId: orderId, Stage: "delivered", OccurredAt: harness.clock.Add(-100 * time.Hour)})
		return err
	})
	harness.clock = harness.clock.Add(200 * time.Hour)
	if released, _ := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(context.Background(), 10); released != 0 {
		t.Fatal("a disputed escrow was auto-released")
	}
	if reply := harness.Call(http.MethodPost, "/api/v1/disputes/"+disputeId+"/messages", seller, "seller-reply-1", map[string]any{"text": "It left our store intact", "attachmentUrls": []string{}}); reply.Status != http.StatusCreated || reply.Body["authorRole"] != "seller" {
		t.Fatalf("seller reply: %d %v", reply.Status, reply.Body)
	}
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve")
	resolveBody := map[string]any{"outcome": "partial", "note": "Partial refund for the tear", "refundAmountMinor": 250_000}
	withoutStepUp := harness.Call(http.MethodPost, "/api/v1/admin/disputes/"+disputeId+"/resolve", staff.AccessToken, "resolve-key-1", resolveBody)
	if withoutStepUp.Status != http.StatusForbidden {
		t.Fatalf("resolution without step-up: %d", withoutStepUp.Status)
	}
	stepUp := http.Header{"X-Step-Up-Token": {staff.StepUpToken}}
	resolved := harness.Call(http.MethodPost, "/api/v1/admin/disputes/"+disputeId+"/resolve", staff.AccessToken, "resolve-key-1", resolveBody, stepUp)
	again := harness.Call(http.MethodPost, "/api/v1/admin/disputes/"+disputeId+"/resolve", staff.AccessToken, "resolve-key-1", resolveBody, stepUp)
	if resolved.Status != http.StatusOK || resolved.Body["status"] != "resolved_refunded" || again.Headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("resolve: %d %v / %v", resolved.Status, resolved.Body, again.Headers)
	}
	if harness.Paystack.RefundCalls != 1 {
		t.Fatalf("refund calls = %d", harness.Paystack.RefundCalls)
	}
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 ||
		harness.balance(ledgermodels.SellerPendingAccount("seller-"+orderId[:4], "NGN")) != 712_500 ||
		harness.balance(ledgermodels.PlatformCommissionRevenueAccount("NGN")) != 37_500 {
		t.Fatal("partial resolution not booked as 250000 refund / 712500 seller / 37500 commission")
	}
	if closedReply := harness.Call(http.MethodPost, "/api/v1/disputes/"+disputeId+"/messages", token, "late-reply-1", map[string]any{"text": "Thanks", "attachmentUrls": []string{}}); closedReply.Status != http.StatusConflict {
		t.Fatalf("message on a resolved dispute: %d", closedReply.Status)
	}
	harness.AssertLedgerHealthy()
}

func TestUnderpaidChargeIsRejectedAndNeverReachesEscrow(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 500_000})
	harness.payCheckoutThroughWebhook(buyer, orderId, 100)
	if view := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", harness.Tokens.UserAccessToken(buyer), "", nil); view.Status != http.StatusNotFound {
		t.Fatalf("underpaid order reached escrow: %d", view.Status)
	}
	if status := harness.Call(http.MethodPost, "/api/v1/payments/orders/"+orderId+"/verify", harness.Tokens.UserAccessToken(buyer), "", nil); status.Body["status"] != "failed" {
		t.Fatalf("underpaid status = %v", status.Body)
	}
	if !contains(harness.Publisher.PublishedEventTypes(), "paymentAmountMismatch.detected") && !outboxHas(t, harness, "paymentAmountMismatch.detected") {
		t.Fatal("amount mismatch was not recorded for operations")
	}
	harness.AssertLedgerHealthy()
}

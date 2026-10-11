package escrow

import (
	"bytes"
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

	first := harness.initializePayment(buyer, firstOrder, "checkout-key-1")
	replay := harness.initializePayment(buyer, firstOrder, "checkout-key-1")
	reused := harness.initializePayment(buyer, secondOrder, "checkout-key-1")
	if first.Status != http.StatusCreated || replay.Body["reference"] != first.Body["reference"] || replay.Headers.Get("Idempotent-Replayed") != "true" || reused.Status != http.StatusConflict {
		t.Fatalf("initialize idempotency broken: %d %v / %v %v / %d", first.Status, first.Body, replay.Body, replay.Headers, reused.Status)
	}
	if amount := first.Body["payment"].(map[string]any)["amount"].(map[string]any)["amountMinor"].(float64); amount != 1_000_000 || first.Body["paymentsInCheckout"].(float64) != 1 || first.Body["checkoutUrl"] == "" {
		t.Fatalf("one Paystack transaction for the whole checkout expected: %v", first.Body)
	}
	if harness.Paystack.Calls("POST /transaction") != 1 {
		t.Fatalf("transactions initialized = %d", harness.Paystack.Calls("POST /transaction"))
	}
	if missingKey := harness.Call(http.MethodPost, "/api/v1/payments/initialize", token, "", map[string]any{"orderId": firstOrder}); missingKey.Status != http.StatusBadRequest {
		t.Fatalf("missing key accepted: %d", missingKey.Status)
	}
	if stranger := harness.initializePayment(uuid.NewString(), firstOrder, "stranger-key"); stranger.Status != http.StatusNotFound {
		t.Fatalf("another user initialized the buyer's order: %d", stranger.Status)
	}
	if pending := harness.Call(http.MethodPost, "/api/v1/payments/orders/"+firstOrder+"/verify", token, "", nil); pending.Body["status"] != "pending" {
		t.Fatalf("expected pending, got %v", pending.Body)
	}

	reference := first.Body["reference"].(string)
	transaction := harness.Paystack.CompleteCheckout(reference, 0, 15_000, "card")
	body, headers := paymentstesting.SignedPaystackWebhook("charge.success", map[string]any{"id": transaction.Id, "reference": reference, "status": "success", "amount": 1_000_000, "currency": "NGN"})
	tampered := bytes.Replace(body, []byte("1000000"), []byte("9000000"), 1)
	if response := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", tampered, headers); response.Status != http.StatusUnauthorized {
		t.Fatalf("tampered webhook accepted: %d", response.Status)
	}
	if unsigned := harness.Call(http.MethodPost, "/webhooks/paystack", "", "", body); unsigned.Status != http.StatusUnauthorized {
		t.Fatalf("unsigned webhook accepted: %d", unsigned.Status)
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
	if paid := harness.Call(http.MethodPost, "/api/v1/payments/orders/"+firstOrder+"/verify", token, "", nil); paid.Body["status"] != "paid" {
		t.Fatalf("expected paid, got %v", paid.Body)
	}
	sellerId := "seller-" + firstOrder[:4]
	escrowId := escrowIdForOrder(t, harness, firstOrder)
	if harness.balance(ledgermodels.SellerEscrowAccount(sellerId, escrowId, "NGN")) != 582_000 || harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")) != 0 ||
		harness.balance(ledgermodels.PlatformFeesUnearnedAccount("NGN")) != 15_000 || harness.balance(ledgermodels.PaymentProcessingFeeExpenseAccount("NGN")) != 0 ||
		harness.balance(ledgermodels.PlatformProviderBalanceAccount("paystack", "NGN")) != harness.Paystack.PlatformBalanceOf("NGN")-10_000_000 {
		t.Fatalf("escrow must hold 600000 less the 1.5%% escrow fee and the Paystack fee, both paid by the seller")
	}

	escrowView := harness.Call(http.MethodGet, "/api/v1/orders/"+firstOrder+"/escrow", token, "", nil)
	if escrowView.Status != http.StatusOK || escrowView.Body["stage"] != "seller_preparing" || escrowView.Body["platformFee"].(map[string]any)["amountMinor"].(float64) != 9_000 {
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
	if harness.balance(ledgermodels.SellerPendingAccount(sellerId, "NGN")) != 582_000 || harness.balance(ledgermodels.SellerAvailableAccount(sellerId, "NGN")) != 0 || harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")) != 9_000 {
		t.Fatal("release did not lock the seller's net and recognise the escrow fee")
	}
	harness.clock = harness.clock.Add(25 * time.Hour)
	if matured, err := harness.escrow.Application.Container.Sellers.MatureDueCredits(context.Background(), harness.Database, 10); err != nil || matured != 1 {
		t.Fatalf("matured %d: %v", matured, err)
	}
	if harness.balance(ledgermodels.SellerAvailableAccount(sellerId, "NGN")) != 582_000 || harness.balance(ledgermodels.SellerPendingAccount(sellerId, "NGN")) != 0 {
		t.Fatal("matured credit did not become available")
	}
	if harness.balance(ledgermodels.SellerEscrowAccount("seller-"+secondOrder[:4], escrowIdForOrder(t, harness, secondOrder), "NGN")) != 388_000 || harness.balance(ledgermodels.PlatformFeesUnearnedAccount("NGN")) != 6_000 {
		t.Fatal("the second seller group of the same payment must be held separately")
	}
	if holds := harness.Call(http.MethodGet, "/api/v1/wallets/me/escrow-holds", harness.Tokens.UserAccessToken("seller-"+secondOrder[:4]), "", nil); len(holds.Body["data"].([]any)) != 1 {
		t.Fatalf("seller holds: %v", holds.Body)
	}
	for attempt := range 2 {
		mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
			result, err := escrows.RefundEscrowInTransaction(ctx, transaction, firstOrder, "item returned after release", escrowservices.EscrowActor{Type: "staff", Id: "staff-1"})
			if err == nil && attempt == 1 && !result.AlreadySettled {
				t.Error("a second refund after a clawback must be a no-op")
			}
			return err
		})
	}
	if clawed := harness.escrow.Application.Container.Client(harness.Database).Escrow.GetX(context.Background(), uuid.MustParse(escrowId)); clawed.Status != "clawedBack" {
		t.Fatalf("a refund after release is a clawback, not a plain refund: %s", clawed.Status)
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
	stepUp := staff.StepUp
	resolved := harness.Call(http.MethodPost, "/api/v1/admin/disputes/"+disputeId+"/resolve", staff.AccessToken, "resolve-key-1", resolveBody, stepUp())
	again := harness.Call(http.MethodPost, "/api/v1/admin/disputes/"+disputeId+"/resolve", staff.AccessToken, "resolve-key-1", resolveBody, stepUp())
	if resolved.Status != http.StatusOK || resolved.Body["status"] != "resolved_refunded" || again.Headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("resolve: %d %v / %v", resolved.Status, resolved.Body, again.Headers)
	}
	harness.Payments.Application.Gateway.RetryPendingRefunds(context.Background(), 10)
	if harness.Paystack.Calls("POST /refund") != 1 || harness.Paystack.Calls("POST /transfer") != 0 {
		t.Fatalf("refund calls = %d, transfers = %d", harness.Paystack.Calls("POST /refund"), harness.Paystack.Calls("POST /transfer"))
	}
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 250_000 {
		t.Fatal("refund must stay payable until Paystack processes it")
	}
	harness.deliverRefundProcessed(harness.paymentReferenceForOrder(orderId))
	if harness.balance(ledgermodels.RefundsPayableAccount("paystack", "NGN")) != 0 ||
		harness.balance(ledgermodels.SellerPendingAccount("seller-"+orderId[:4], "NGN")) != 723_750 ||
		harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")) != 11_250 {
		t.Fatal("partial resolution not booked as 250000 refund / 723750 seller / 11250 escrow fee")
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

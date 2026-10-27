package escrow

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
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
		t.Fatalf("one provider transaction for the whole checkout expected: %v", first.Body)
	}
	if harness.Flutterwave.Calls("POST /payments") != 1 {
		t.Fatalf("transactions initialized = %d", harness.Flutterwave.Calls("POST /payments"))
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
	transaction := harness.Flutterwave.CompleteCheckout(reference, 0, 15_000, "card")
	body, headers := harness.Flutterwave.ChargeWebhook(transaction)
	forged := http.Header{"Verif-Hash": {"not-the-shared-secret"}}
	if response := harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, forged); response.Status != http.StatusUnauthorized {
		t.Fatalf("webhook with a wrong verif-hash accepted: %d", response.Status)
	}
	if unsigned := harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body); unsigned.Status != http.StatusUnauthorized {
		t.Fatalf("unsigned webhook accepted: %d", unsigned.Status)
	}
	var group sync.WaitGroup
	for range 5 {
		group.Add(1)
		go func() {
			defer group.Done()
			if response := harness.Call(http.MethodPost, "/api/v1/payments/webhooks/flutterwave", "", "", body, headers); response.Status != http.StatusOK {
				t.Errorf("webhook delivery: %d %s", response.Status, response.Raw)
			}
		}()
	}
	group.Wait()
	if duplicate := harness.Call(http.MethodPost, "/webhooks/flutterwave", "", "", body, headers); duplicate.Body["duplicate"] != true {
		t.Fatalf("replayed webhook not reported as duplicate: %v", duplicate.Body)
	}
	if paid := harness.Call(http.MethodPost, "/api/v1/payments/orders/"+firstOrder+"/verify", token, "", nil); paid.Body["status"] != "paid" {
		t.Fatalf("expected paid, got %v", paid.Body)
	}
	harness.SetCountry(buyer, "NG")
	escrowId := escrowIdForOrder(t, harness, firstOrder)
	escrowClient := harness.escrow.Application.Container.Client(harness.Database)
	if held := escrowClient.Escrow.GetX(context.Background(), uuid.MustParse(escrowId)); string(held.Custody) != "buyerWalletLock" || held.WalletFundedAt != nil {
		t.Fatalf("a card escrow waits for settlement before it reaches the buyer's wallet: %+v", held)
	}
	harness.SettleCardPayments("NGN")
	if locked := harness.balance(ledgermodels.WalletEscrowLockedAccount(buyer, escrowId, "NGN")); locked != 600_000 || harness.balance(ledgermodels.PaymentsAwaitingApplicationAccount("NGN")) != 0 {
		t.Fatalf("after settlement the first order is locked in the buyer's wallet: locked %d, balances %v", locked, harness.NonZeroBalances())
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
	harness.RunMoneyWorkers()
	released := escrowClient.Escrow.GetX(context.Background(), uuid.MustParse(escrowId))
	if released.Status != "released" || harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")) != released.CommissionMinor || released.CommissionMinor != 9_000 {
		t.Fatalf("release must pay the seller and recognise the escrow fee: %+v %v", released, harness.NonZeroBalances())
	}
	if got := harness.Flutterwave.WalletBalance(harness.WalletRef(sellerForOrder(firstOrder)), "NGN"); got != released.SellerAmountMinor {
		t.Fatalf("seller wallet holds %d, want %d", got, released.SellerAmountMinor)
	}
	secondEscrow := escrowIdForOrder(t, harness, secondOrder)
	if harness.balance(ledgermodels.WalletEscrowLockedAccount(buyer, secondEscrow, "NGN")) != 400_000 {
		t.Fatal("the second seller group of the same payment must be held separately")
	}
	if holds := harness.Call(http.MethodGet, "/api/v1/wallets/me/escrow-holds", harness.Tokens.UserAccessToken(buyer), "", nil); holds.Status != http.StatusOK {
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
	harness.payAndSettle(buyer, orderId)
	token := harness.Tokens.UserAccessToken(buyer)
	seller := harness.Tokens.UserAccessToken(sellerForOrder(orderId))

	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", token, "dispute-key-1", map[string]any{"reason": "damaged", "description": "Torn on arrival", "evidenceUrls": []string{"https://cdn.nantty.test/a.jpg"}})
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
	harness.RunMoneyWorkers()
	if harness.Flutterwave.Calls("POST /transactions") != 0 {
		t.Fatalf("a settled card escrow is refunded inside the buyer's wallet, not to the card: %d refund calls", harness.Flutterwave.Calls("POST /transactions"))
	}
	if available := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")); available != 250_000 {
		t.Fatalf("the partial refund is unlocked in the buyer's wallet: %d %v", available, harness.NonZeroBalances())
	}
	resolvedEscrow := harness.escrow.Application.Container.Client(harness.Database).Escrow.GetX(context.Background(), uuid.MustParse(escrowIdForOrder(t, harness, orderId)))
	if resolvedEscrow.ReleasedToSellerMinor != 724_750 || harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")) != 11_250 {
		t.Fatalf("partial resolution not booked as 250000 refund / 724750 seller (after the 14000 card fee) / 11250 escrow fee: %+v %v", resolvedEscrow, harness.NonZeroBalances())
	}
	if got := harness.Flutterwave.WalletBalance(harness.WalletRef(sellerForOrder(orderId)), "NGN"); got != resolvedEscrow.ReleasedToSellerMinor {
		t.Fatalf("seller wallet holds %d, want %d", got, resolvedEscrow.ReleasedToSellerMinor)
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

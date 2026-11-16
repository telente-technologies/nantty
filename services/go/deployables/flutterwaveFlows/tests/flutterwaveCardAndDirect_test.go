package flutterwaveflows

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	escrowoutbox "nantty/modules/escrow/src/generated/ent/outboxevent"
	"nantty/modules/escrow/src/modules/escrows/services"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/interfaces"
	"nantty/platform/httpserver"
)

func (harness *flowHarness) refundEscrow(placed order, reason string) error {
	return databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.RefundEscrowInTransaction(ctx, transaction, placed.orderId, reason, services.EscrowActor{Type: "staff", Id: "staff-1"})
		return err
	})
}

func (harness *flowHarness) refundDestinationAnnounced(placed order) string {
	harness.T.Helper()
	event, err := harness.escrowClient().OutboxEvent.Query().Where(escrowoutbox.EventType("escrow.refunded"), escrowoutbox.Subject(placed.orderId)).Only(context.Background())
	if err != nil {
		harness.T.Fatal(err)
	}
	var envelope struct {
		Data struct {
			RefundDestination string `json:"refundDestination"`
		} `json:"data"`
	}
	if err := json.Unmarshal(event.Payload, &envelope); err != nil {
		harness.T.Fatal(err)
	}
	return envelope.Data.RefundDestination
}

func TestCardBuyerRefundedBeforeSettlementGetsTheCardRefundAndAfterSettlementGetsTheWalletUnlocked(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	early := harness.registerOrder(buyer, seller, 200_000, "NGN", "escrow")
	harness.initialize(buyer, &early)
	harness.payByCard(early, 3_000)
	if held := harness.escrowFor(early); held.WalletFundedAt != nil || string(held.Custody) != "buyerWalletLock" {
		t.Fatalf("a card escrow waits for settlement before it reaches the buyer's wallet: %+v", held)
	}
	if err := harness.refundEscrow(early, "seller cancelled"); err != nil {
		t.Fatal(err)
	}
	harness.gateway.RetryPendingRefunds(context.Background(), 10)
	if len(harness.fake.Refunds) != 1 {
		t.Fatalf("the refund goes back to the card through the outbox: %v", harness.fake.Refunds)
	}
	if destination := harness.refundDestinationAnnounced(early); destination != "paymentMethod" {
		t.Fatalf("the buyer is told the refund goes back to the card, got %q", destination)
	}
	late := harness.registerOrder(buyer, seller, 150_000, "NGN", "escrow")
	harness.initialize(buyer, &late)
	harness.payByCard(late, 2_250)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleCard("NGN")
	held := harness.escrowFor(late)
	if held.WalletFundedAt == nil {
		movement, _ := harness.gateway.FindMovementBySubject(context.Background(), harness.Database, "escrowFundIn", held.ID.String())
		t.Fatalf("after settlement the card money must move into the buyer's wallet: %+v", movement)
	}
	if got := harness.fake.WalletBalance(harness.walletRef(buyer), "NGN"); got != 150_000 {
		t.Fatalf("buyer wallet holds %d, want the full order", got)
	}
	if err := harness.refundEscrow(late, "item not as described"); err != nil {
		t.Fatal(err)
	}
	if available := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")); available != 150_000 {
		t.Fatalf("refund must unlock the order in the buyer's wallet, available %d", available)
	}
	if destination := harness.refundDestinationAnnounced(late); destination != "wallet" {
		t.Fatalf("the buyer is told the refund is in their Nantty wallet, got %q", destination)
	}
	harness.assertWalletMatchesProvider(buyer)
	harness.AssertLedgerHealthy()
}

func TestGhanaBuyerAndVerifiedGhanaSellerUseDirectModeAndTheSellerIsPaidAfterSettlement(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("GH"), harness.newUser("GH")
	harness.markIdentityVerified(seller)
	harness.markSellerBusinessVerified(seller)
	harness.OnboardConnectedAccount(seller, true)
	placed := harness.registerOrder(buyer, seller, 50_000, "GHS", "escrow")
	harness.initialize(buyer, &placed)
	harness.payByCard(placed, 1_000)
	held := harness.escrowFor(placed)
	if held.PaymentMode != "direct" || held.Status != "released" {
		t.Fatalf("outside Nigeria orders are direct with no escrow: %+v", held)
	}
	harness.fake.FundMainBalance("GHS", 100_000)
	harness.settleCard("GHS")
	if sent := harness.escrow.Application.Escrows.PayDirectSellersAfterSettlement(context.Background(), 10); sent != 1 {
		t.Fatalf("seller payout after settlement: %d", sent)
	}
	paidOut := harness.escrowFor(placed)
	harness.fake.SetPayoutOutcome(paidOut.DirectPayoutReference, interfaces.OutcomeSucceeded)
	body, headers := harness.fake.TransferWebhook(paidOut.DirectPayoutReference)
	if response := harness.deliver(body, headers); response.Status != http.StatusOK {
		t.Fatalf("transfer webhook: %d %s", response.Status, response.Raw)
	}
	if owed := harness.balance(ledgermodels.DirectSellerPayableAccount(seller, "GHS")); owed != 0 {
		t.Fatalf("the platform must owe the seller nothing after payout, owes %d", owed)
	}
	harness.AssertLedgerHealthy()
}

func TestUnverifiedGhanaSellerCannotSell(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller := harness.newUser("GH"), harness.newUser("GH")
	err := harness.gateway.RegisterCheckoutPayables(context.Background(), harness.payablesFor(buyer, seller, 50_000, "GHS"))
	var apiError *httpserver.ApiError
	if !errors.As(err, &apiError) || apiError.Code != "VERIFICATION_REQUIRED" || apiError.VerifyUrl == "" {
		t.Fatalf("an unverified seller outside Nigeria must be refused with VERIFICATION_REQUIRED: %v", err)
	}
	eligibility := harness.Call(http.MethodGet, "/api/v1/internal/sellers/"+seller+"/selling-eligibility", "", "", nil, http.Header{"X-Internal-Token": {harness.Payments.Application.Container.Settings.InternalApiToken}})
	if eligibility.Status != http.StatusOK || eligibility.Body["canSell"] != false {
		t.Fatalf("eligibility endpoint: %d %s", eligibility.Status, eligibility.Raw)
	}
}

package flutterwaveflows

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	escrowent "nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrowevent"
	escrowoutbox "nantty/modules/escrow/src/generated/ent/outboxevent"
	"nantty/modules/escrow/src/generated/ent/pendingrefund"
	refundordergroup "nantty/modules/escrow/src/modules/escrows/commands/refundOrderGroup"
	"nantty/modules/escrow/src/modules/escrows/dtos"
	escrowservices "nantty/modules/escrow/src/modules/escrows/services"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent/providermovement"
)

func (harness *flowHarness) cardPaidOrder(amountMinor int64) (string, string, order) {
	harness.T.Helper()
	buyer, seller := harness.newUser("NG"), harness.newUser("NG")
	harness.verifyToLevelOne(seller)
	placed := harness.registerOrder(buyer, seller, amountMinor, "NGN", "escrow")
	harness.initialize(buyer, &placed)
	harness.payByCard(placed, amountMinor*15/1000)
	if held := harness.escrowFor(placed); held.WalletFundedAt != nil {
		harness.T.Fatalf("a card escrow waits for settlement: %+v", held)
	}
	return buyer, seller, placed
}

func (harness *flowHarness) requestRefund(buyer string, placed order, amountMinor int64, reason string) (dtos.EscrowDetailDto, bool, error) {
	return refundordergroup.Handler{Application: harness.escrow.Application}.Execute(context.Background(), refundordergroup.Command{
		OrderGroupId: placed.orderId, StoreId: "store-1", BuyerAccountId: buyer, AmountMinor: amountMinor, Currency: "NGN", Reason: reason,
	})
}

func (harness *flowHarness) escrowClient() *escrowent.Client {
	return harness.escrow.Application.Container.Client(harness.Database)
}

func (harness *flowHarness) pendingRefunds(placed order) []*escrowent.PendingRefund {
	harness.T.Helper()
	rows, err := harness.escrowClient().PendingRefund.Query().Where(pendingrefund.OrderID(placed.orderId)).Order(escrowent.Asc(pendingrefund.FieldCreatedAt)).All(context.Background())
	if err != nil {
		harness.T.Fatal(err)
	}
	return rows
}

func (harness *flowHarness) escrowEventCount(placed order, eventType string) int {
	harness.T.Helper()
	count, err := harness.escrowClient().EscrowEvent.Query().Where(escrowevent.EscrowID(harness.escrowFor(placed).ID), escrowevent.EventType(eventType)).Count(context.Background())
	if err != nil {
		harness.T.Fatal(err)
	}
	return count
}

func (harness *flowHarness) settleTwice() {
	harness.settleCard("NGN")
	harness.settleCard("NGN")
	harness.gateway.ProcessProviderSettlements(context.Background(), nil)
	harness.runWorkers()
	harness.escrow.Application.Escrows.ExecuteDueScheduledRefunds(context.Background(), 10)
	harness.runWorkers()
}

func TestARefundBeforeCardSettlementIsScheduledAndRunsExactlyOnceWhenSettlementLandsTwice(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, seller, placed := harness.cardPaidOrder(200_000)
	detail, _, err := harness.requestRefund(buyer, placed, 50_000, "Seller refund: one item damaged")
	if err != nil {
		t.Fatalf("a refund before settlement must be accepted and scheduled, not fail: %v", err)
	}
	if detail.RefundScheduled == nil || detail.RefundScheduled.Amount.AmountMinor != 50_000 || detail.Status != "held" {
		t.Fatalf("the buyer and seller must see the refund as scheduled: %+v", detail)
	}
	if rows := harness.pendingRefunds(placed); len(rows) != 1 || rows[0].Status != pendingrefund.StatusScheduled || rows[0].Full {
		t.Fatalf("exactly one scheduled partial refund: %+v", rows)
	}
	announced, err := harness.escrowClient().OutboxEvent.Query().Where(escrowoutbox.EventType("escrow.refundScheduled"), escrowoutbox.Subject(placed.orderId)).Count(context.Background())
	if err != nil || announced != 1 {
		t.Fatalf("escrow.refundScheduled must be published once for orders and notifications: %d %v", announced, err)
	}
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleTwice()
	held := harness.escrowFor(placed)
	if held.WalletFundedAt == nil || held.Status != "partiallyRefunded" || held.RefundedMinor != 50_000 {
		t.Fatalf("settlement must run the scheduled refund: %+v", held)
	}
	if rows := harness.pendingRefunds(placed); rows[0].Status != pendingrefund.StatusExecuted || rows[0].ExecutedAt == nil {
		t.Fatalf("the scheduled refund must be marked executed: %+v", rows[0])
	}
	if executed := harness.escrowEventCount(placed, "scheduledRefundExecuted"); executed != 1 {
		t.Fatalf("the refund must run exactly once, ran %d times", executed)
	}
	if available := harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) + harness.balance(ledgermodels.WalletDepositHoldAccount(buyer, "NGN")); available != 50_000 {
		t.Fatalf("the buyer's wallet must get exactly the refund, got %d", available)
	}
	if got := harness.fake.WalletBalance(harness.walletRef(seller), "NGN"); got != held.ReleasedToSellerMinor || got <= 0 {
		t.Fatalf("the seller keeps the rest: wallet %d, released %d", got, held.ReleasedToSellerMinor)
	}
	if _, replayed, err := harness.requestRefund(buyer, placed, 50_000, "Seller refund: one item damaged"); err != nil || !replayed {
		t.Fatalf("a redelivered refund event after execution must replay: %v %v", replayed, err)
	}
	harness.escrow.Application.Escrows.ExecuteDueScheduledRefunds(context.Background(), 10)
	if again := harness.escrowFor(placed); again.RefundedMinor != 50_000 || harness.escrowEventCount(placed, "scheduledRefundExecuted") != 1 {
		t.Fatalf("nothing may run twice: %+v", again)
	}
	harness.assertWalletMatchesProvider(buyer)
	harness.assertWalletMatchesProvider(seller)
	harness.AssertLedgerHealthy()
}

func TestDuplicateRefundRequestsBeforeSettlementRefundOnlyOnce(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, _, placed := harness.cardPaidOrder(300_000)
	for range 2 {
		if _, _, err := harness.requestRefund(buyer, placed, 120_000, "Seller refund: wrong size"); err != nil {
			t.Fatal(err)
		}
	}
	if _, replayed, err := harness.requestRefund(buyer, placed, 120_000, "Seller refund: wrong size"); err != nil || !replayed {
		t.Fatalf("a redelivered refund event must replay: replayed=%v %v", replayed, err)
	}
	if _, _, err := harness.requestRefund(buyer, placed, 120_000, "Seller refund: wrong size (resubmitted)"); err != nil {
		t.Fatal(err)
	}
	if rows := harness.pendingRefunds(placed); len(rows) != 2 {
		t.Fatalf("one row per distinct request: %+v", rows)
	}
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleTwice()
	held := harness.escrowFor(placed)
	if held.RefundedMinor != 120_000 || held.Status != "partiallyRefunded" {
		t.Fatalf("the same refund resubmitted must not be paid twice: %+v", held)
	}
	rows := harness.pendingRefunds(placed)
	if rows[0].Status != pendingrefund.StatusExecuted || rows[1].Status != pendingrefund.StatusSuperseded {
		t.Fatalf("first executes, the resubmission is superseded: %s %s", rows[0].Status, rows[1].Status)
	}
	if spendable := harness.spendable(buyer); spendable != 120_000 {
		t.Fatalf("buyer refunded %d, want 120000 once", spendable)
	}
	harness.AssertLedgerHealthy()
}

func TestAFullRefundWhileTheSettlementTransferIsInFlightIsScheduledAndUnlocksTheWalletOnce(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, _, placed := harness.cardPaidOrder(150_000)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.fake.SettleAll("NGN")
	harness.gateway.ProcessProviderSettlements(context.Background(), nil)
	ctx := context.Background()
	fundIn, err := harness.gateway.FindMovementBySubject(ctx, harness.Database, "escrowFundIn", harness.escrowFor(placed).ID.String())
	if err != nil || fundIn == nil {
		t.Fatalf("fund-in movement: %v", err)
	}
	if err := harness.paymentsClient().ProviderMovement.UpdateOneID(fundIn.ID).SetStatus(providermovement.StatusProcessing).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	detail, _, err := harness.requestRefund(buyer, placed, 150_000, "Seller cancelled")
	if err != nil || detail.RefundScheduled == nil {
		t.Fatalf("a full refund racing the settlement transfer must be scheduled: %+v %v", detail, err)
	}
	if len(harness.fake.Refunds) != 0 {
		t.Fatalf("no card refund may be sent while the money is moving into the wallet: %v", harness.fake.Refunds)
	}
	if err := harness.paymentsClient().ProviderMovement.UpdateOneID(fundIn.ID).SetStatus(providermovement.StatusPending).SetBlockedOn(fundIn.BlockedOn).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	harness.settleTwice()
	held := harness.escrowFor(placed)
	if held.Status != "refunded" || held.RefundedMinor != 150_000 {
		t.Fatalf("the scheduled full refund must run after the transfer lands: %+v", held)
	}
	if spendable := harness.spendable(buyer); spendable != 150_000 {
		t.Fatalf("the whole order returns to the buyer's own wallet once, got %d", spendable)
	}
	harness.assertWalletMatchesProvider(buyer)
	harness.AssertLedgerHealthy()
}

func TestARefundAfterSettlementRunsImmediately(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, _, placed := harness.cardPaidOrder(200_000)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleCard("NGN")
	detail, _, err := harness.requestRefund(buyer, placed, 80_000, "Seller refund: late delivery")
	if err != nil || detail.RefundScheduled != nil || detail.Status != "partiallyRefunded" {
		t.Fatalf("after settlement the refund must run straight away: %+v %v", detail, err)
	}
	if rows := harness.pendingRefunds(placed); len(rows) != 0 {
		t.Fatalf("nothing is scheduled after settlement: %+v", rows)
	}
	harness.runWorkers()
	if spendable := harness.spendable(buyer); spendable != 80_000 {
		t.Fatalf("buyer refunded %d", spendable)
	}
	harness.AssertLedgerHealthy()
}

func TestEscrowCannotBeReleasedWhileARefundIsScheduled(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, _, early := harness.cardPaidOrder(200_000)
	if _, _, err := harness.requestRefund(buyer, early, 60_000, "Seller refund: missing part"); err != nil {
		t.Fatal(err)
	}
	if err := harness.confirmReceipt(buyer, early); !errors.Is(err, escrowservices.ErrRefundScheduled) {
		t.Fatalf("buyer confirmation must not release while a refund is scheduled: %v", err)
	}
	otherBuyer, _, funded := harness.cardPaidOrder(200_000)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleCard("NGN")
	ctx := context.Background()
	err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.ScheduleRefundUntilFundsSettleInTransaction(ctx, transaction, funded.orderId, escrowservices.PendingRefundRequest{
			RequestKey: "left-over-after-a-failed-run", AmountMinor: 70_000, Reason: "Seller refund: scratched", Actor: escrowservices.EscrowActor{Type: "commerce", Id: "store-1"},
		})
		if err != nil {
			return err
		}
		held, err := harness.escrow.Application.Escrows.LockEscrowForOrder(ctx, harness.escrow.Application.Container.Client(transaction), funded.orderId)
		if err != nil {
			return err
		}
		return held.Update().SetAutoReleaseAt(harness.clock.Add(-time.Hour)).Exec(ctx)
	})
	if err != nil {
		t.Fatal(err)
	}
	if released, err := harness.escrow.Application.Escrows.ReleaseEscrowsWhoseInspectionPeriodEnded(ctx, 10); err != nil || released != 0 {
		t.Fatalf("the auto-release sweep must skip an escrow with a scheduled refund: released %d %v", released, err)
	}
	if err := harness.confirmReceipt(otherBuyer, funded); !errors.Is(err, escrowservices.ErrRefundScheduled) {
		t.Fatalf("a funded escrow with a scheduled refund must still refuse release: %v", err)
	}
	if held := harness.escrowFor(funded); held.Status != "held" {
		t.Fatalf("escrow must stay held: %s", held.Status)
	}
	if executed := harness.escrow.Application.Escrows.ExecuteDueScheduledRefunds(ctx, 10); executed != 1 {
		t.Fatalf("the sweeper must run the refund it finds funded, ran %d", executed)
	}
	harness.runWorkers()
	if held := harness.escrowFor(funded); held.Status != "partiallyRefunded" || held.RefundedMinor != 70_000 {
		t.Fatalf("after the sweeper: %+v", held)
	}
	if held := harness.escrowFor(early); held.Status != "partiallyRefunded" || held.RefundedMinor != 60_000 {
		t.Fatalf("the refund scheduled before settlement ran at settlement: %+v", held)
	}
	if executed := harness.escrow.Application.Escrows.ExecuteDueScheduledRefunds(ctx, 10); executed != 0 {
		t.Fatalf("a second sweep must find nothing, ran %d", executed)
	}
	harness.AssertLedgerHealthy()
}

func TestConcurrentSweepsRunAScheduledRefundOnlyOnce(t *testing.T) {
	harness := startFlowHarness(t)
	buyer, _, placed := harness.cardPaidOrder(200_000)
	harness.fake.FundMainBalance("NGN", 1_000_000)
	harness.settleCard("NGN")
	ctx := context.Background()
	err := databases.RunInMoneyTransaction(ctx, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.escrow.Application.Escrows.ScheduleRefundUntilFundsSettleInTransaction(ctx, transaction, placed.orderId, escrowservices.PendingRefundRequest{
			RequestKey: "race", AmountMinor: 90_000, Reason: "Seller refund: race", Actor: escrowservices.EscrowActor{Type: "commerce", Id: "store-1"},
		})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	results := make(chan int, 6)
	for range 6 {
		go func() { results <- harness.escrow.Application.Escrows.ExecuteDueScheduledRefunds(ctx, 10) }()
	}
	total := 0
	for range 6 {
		total += <-results
	}
	harness.runWorkers()
	if held := harness.escrowFor(placed); total != 1 || held.RefundedMinor != 90_000 {
		t.Fatalf("six racing sweeps must run the refund exactly once: ran %d, escrow %+v", total, held)
	}
	if spendable := harness.spendable(buyer); spendable != 90_000 {
		t.Fatalf("buyer refunded %d", spendable)
	}
	harness.AssertLedgerHealthy()
}

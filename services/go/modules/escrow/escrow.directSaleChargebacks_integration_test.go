package escrow

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
)

type directSaleChargebackCase struct {
	harness   *escrowHarness
	buyer     string
	orderId   string
	seller    string
	reference string
}

func startDirectSale(t *testing.T, amountMinor int64) directSaleChargebackCase {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckoutWithMode(buyer, map[string]int64{orderId: amountMinor}, "direct", true)
	reference := harness.payCheckoutThroughWebhook(buyer, orderId, 0)
	return directSaleChargebackCase{harness: harness, buyer: buyer, orderId: orderId, seller: sellerForOrder(orderId), reference: reference}
}

func (sale directSaleChargebackCase) loseChargeback(amountMinor int64) string {
	sale.harness.T.Helper()
	chargeback, opened := sale.harness.Flutterwave.OpenChargeback(sale.reference, amountMinor)
	if !opened {
		sale.harness.T.Fatal("no chargeback opened")
	}
	gateway := sale.harness.Payments.Application.Gateway
	if _, err := gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		sale.harness.T.Fatal(err)
	}
	disputeId := fmt.Sprint(chargeback["id"])
	sale.harness.Flutterwave.ResolveChargeback(disputeId, false)
	if _, err := gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		sale.harness.T.Fatal(err)
	}
	return disputeId
}

func (sale directSaleChargebackCase) escrowRow() *ent.Escrow {
	return sale.harness.escrow.Application.Container.Client(sale.harness.Database).Escrow.Query().Where(escrow.OrderID(sale.orderId)).OnlyX(context.Background())
}

func (sale directSaleChargebackCase) providerBalances() (ledger, provider int64) {
	return sale.harness.balance(ledgermodels.PlatformProviderBalanceAccount("flutterwave", "NGN")), sale.harness.Flutterwave.MainBalanceOf("NGN")
}

func (sale directSaleChargebackCase) assertProviderBalanceMovedLikeTheProvider(ledgerBefore, providerBefore int64) {
	sale.harness.T.Helper()
	ledgerAfter, providerAfter := sale.providerBalances()
	if ledgerAfter-ledgerBefore != providerAfter-providerBefore {
		sale.harness.T.Fatalf("the ledger moved the provider balance by %d while the provider moved it by %d", ledgerAfter-ledgerBefore, providerAfter-providerBefore)
	}
}

func TestALostChargebackOnADirectSaleBecomesSellerDebtAndClosesTheWithholdingOnce(t *testing.T) {
	sale := startDirectSale(t, 200_000)
	ledgerBefore, providerBefore := sale.providerBalances()
	disputeId := sale.loseChargeback(0)
	sale.assertProviderBalanceMovedLikeTheProvider(ledgerBefore, providerBefore)
	harness := sale.harness
	if debt, receivable := harness.balance(ledgermodels.SellerDebtAccount(sale.seller, "NGN")), harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); debt != 200_000 || receivable != 0 {
		t.Fatalf("the seller owes the disputed amount and the withholding is closed: debt %d receivable %d %v", debt, receivable, harness.NonZeroBalances())
	}
	held := sale.escrowRow()
	if held.Status != escrow.StatusRefunded || held.RefundedMinor != 200_000 {
		t.Fatalf("escrow after the lost chargeback: %s %d", held.Status, held.RefundedMinor)
	}
	notice := paymentmodels.ProviderDisputeNotice{PaymentIntentId: held.PaymentIntentID, ProviderDisputeId: disputeId, Status: "lost", AmountMinor: 200_000}
	for range 2 {
		mustRunInTransaction(t, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
			return harness.escrow.Application.Escrows.HandleProviderDispute(ctx, transaction, notice)
		})
	}
	if debt := harness.balance(ledgermodels.SellerDebtAccount(sale.seller, "NGN")); debt != 200_000 {
		t.Fatalf("a duplicate lost notice must not post again: debt %d", debt)
	}
	harness.AssertLedgerHealthy()
}

func TestALostChargebackAfterADirectSaleWasRefundedDoesNotChargeTheSellerTwice(t *testing.T) {
	sale := startDirectSale(t, 200_000)
	harness := sale.harness
	if full := sellerRefundRequest(harness, sale.orderId, sale.buyer, 200_000); full.Body["status"] != "refunded" {
		t.Fatalf("full seller refund: %d %s", full.Status, full.Raw)
	}
	harness.deliverRefundProcessed(sale.reference)
	debtAfterRefund := harness.balance(ledgermodels.SellerDebtAccount(sale.seller, "NGN"))
	ledgerBefore, providerBefore := sale.providerBalances()
	sale.loseChargeback(0)
	sale.assertProviderBalanceMovedLikeTheProvider(ledgerBefore, providerBefore)
	if debt := harness.balance(ledgermodels.SellerDebtAccount(sale.seller, "NGN")); debt != debtAfterRefund {
		t.Fatalf("the seller already repaid the buyer through the refund: debt %d, was %d", debt, debtAfterRefund)
	}
	if receivable := harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); receivable != 200_000 {
		t.Fatalf("a chargeback on a refunded payment stays a claim against the provider: %d", receivable)
	}
	if held := sale.escrowRow(); held.Status != escrow.StatusRefunded || held.RefundedMinor != held.SellerAmountMinor {
		t.Fatalf("a refund after the seller was paid returns only the seller's portion: %s %d", held.Status, held.RefundedMinor)
	}
	harness.AssertLedgerHealthy()
}

func TestASecondLostChargebackAfterAPartialOneJournalsOnlyTheUnrecoveredRest(t *testing.T) {
	sale := startDirectSale(t, 200_000)
	harness := sale.harness
	ledgerBefore, providerBefore := sale.providerBalances()
	sale.loseChargeback(50_000)
	if held := sale.escrowRow(); held.Status != escrow.StatusPartiallyRefunded || held.RefundedMinor != 50_000 {
		t.Fatalf("after a partial lost chargeback: %s %d", held.Status, held.RefundedMinor)
	}
	sale.loseChargeback(150_000)
	sale.assertProviderBalanceMovedLikeTheProvider(ledgerBefore, providerBefore)
	if debt, receivable := harness.balance(ledgermodels.SellerDebtAccount(sale.seller, "NGN")), harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); debt != 200_000 || receivable != 0 {
		t.Fatalf("both withholdings become seller debt: debt %d receivable %d %v", debt, receivable, harness.NonZeroBalances())
	}
	if held := sale.escrowRow(); held.Status != escrow.StatusRefunded || held.RefundedMinor != 200_000 {
		t.Fatalf("escrow after both chargebacks: %s %d", held.Status, held.RefundedMinor)
	}
	harness.AssertLedgerHealthy()
}

func TestRefundingTheRestOfAPartlyChargedBackDirectSaleRefundsOnlyWhatTheBuyerStillMisses(t *testing.T) {
	sale := startDirectSale(t, 200_000)
	harness := sale.harness
	sale.loseChargeback(50_000)
	if rest := commerceRefund(harness, sale.orderId, sale.buyer, 150_000, "returned"); rest.Status != 200 || rest.Body["status"] != "refunded" {
		t.Fatalf("refunding the rest: %d %s", rest.Status, rest.Raw)
	}
	_, refunded := refundRowsForOrder(t, harness, sale.reference)
	held := sale.escrowRow()
	if rest := held.SellerAmountMinor - 50_000; held.RefundedMinor != held.SellerAmountMinor || refunded != rest {
		t.Fatalf("the provider refunds only the seller's portion the chargeback did not return (processing fee kept): escrow %d, provider refunds %d, want %d", held.RefundedMinor, refunded, rest)
	}
	if debt := harness.balance(ledgermodels.SellerDebtAccount(sale.seller, "NGN")); debt != held.SellerAmountMinor {
		t.Fatalf("the seller owes the chargeback and the refunded rest: %d", debt)
	}
	harness.AssertLedgerHealthy()
}

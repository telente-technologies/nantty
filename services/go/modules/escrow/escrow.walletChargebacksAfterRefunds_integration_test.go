package escrow

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent/escrow"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

type walletChargebackCase struct {
	harness   *escrowHarness
	buyer     string
	orderId   string
	seller    string
	reference string
}

func startWalletEscrowSale(t *testing.T, amountMinor int64) walletChargebackCase {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: amountMinor})
	reference := harness.payAndSettle(buyer, orderId)
	return walletChargebackCase{harness: harness, buyer: buyer, orderId: orderId, seller: sellerForOrder(orderId), reference: reference}
}

func (sale walletChargebackCase) walletMoney(userId string) int64 {
	return sale.harness.balance(ledgermodels.WalletAvailableAccount(userId, "NGN")) + sale.harness.balance(ledgermodels.WalletDepositHoldAccount(userId, "NGN")) -
		sale.harness.balance(ledgermodels.WalletDebtAccount(userId, "NGN"))
}

func (sale walletChargebackCase) loseChargeback() string {
	sale.harness.T.Helper()
	chargeback, opened := sale.harness.Flutterwave.OpenChargeback(sale.reference, 0)
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
	sale.harness.RunMoneyWorkers()
	return disputeId
}

func (sale walletChargebackCase) replayLostNotice(disputeId string, amountMinor int64) {
	harness := sale.harness
	held := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(sale.orderId)).OnlyX(context.Background())
	mustRunInTransaction(harness.T, harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return harness.escrow.Application.Escrows.HandleProviderDispute(ctx, transaction, paymentmodels.ProviderDisputeNotice{PaymentIntentId: held.PaymentIntentID, ProviderDisputeId: disputeId, Status: "lost", AmountMinor: amountMinor})
	})
	harness.RunMoneyWorkers()
}

func TestALostChargebackAfterAPartialWalletRefundRecoversTheRefundFromTheBuyerAndTheRestFromTheSale(t *testing.T) {
	sale := startWalletEscrowSale(t, 300_000)
	harness := sale.harness
	if partial := commerceRefund(harness, sale.orderId, sale.buyer, 100_000, "one item damaged"); partial.Status != 200 {
		t.Fatalf("partial refund: %d %s", partial.Status, partial.Raw)
	}
	harness.RunMoneyWorkers()
	buyerBefore, sellerBefore := sale.walletMoney(sale.buyer), sale.walletMoney(sale.seller)
	disputeId := sale.loseChargeback()
	if receivable := harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); receivable != 0 {
		t.Fatalf("the whole withholding is journaled: receivable %d %v", receivable, harness.NonZeroBalances())
	}
	if buyerTaken, sellerTaken := buyerBefore-sale.walletMoney(sale.buyer), sellerBefore-sale.walletMoney(sale.seller); buyerTaken != 100_000 || sellerTaken != sellerBefore {
		t.Fatalf("the buyer returns the in-wallet refund and the seller its kept share: buyer %d seller %d of %d", buyerTaken, sellerTaken, sellerBefore)
	}
	held := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(sale.orderId)).OnlyX(context.Background())
	if held.Status != escrow.StatusRefunded || held.RefundedMinor != 300_000 {
		t.Fatalf("escrow: %s %d", held.Status, held.RefundedMinor)
	}
	buyerAfter, sellerAfter := sale.walletMoney(sale.buyer), sale.walletMoney(sale.seller)
	sale.replayLostNotice(disputeId, 300_000)
	if sale.walletMoney(sale.buyer) != buyerAfter || sale.walletMoney(sale.seller) != sellerAfter {
		t.Fatal("a duplicate lost notice must not recover twice")
	}
	harness.AssertLedgerHealthy()
}

func TestALostChargebackAfterAFullWalletRefundRecoversItFromTheBuyerOnce(t *testing.T) {
	sale := startWalletEscrowSale(t, 200_000)
	harness := sale.harness
	if full := commerceRefund(harness, sale.orderId, sale.buyer, 200_000, "never arrived"); full.Status != 200 || full.Body["status"] != "refunded" {
		t.Fatalf("full refund: %d %s", full.Status, full.Raw)
	}
	harness.RunMoneyWorkers()
	buyerBefore := sale.walletMoney(sale.buyer)
	disputeId := sale.loseChargeback()
	if receivable := harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); receivable != 0 || buyerBefore-sale.walletMoney(sale.buyer) != 200_000 {
		t.Fatalf("the buyer was paid twice and returns the wallet refund: receivable %d, buyer %d -> %d", receivable, buyerBefore, sale.walletMoney(sale.buyer))
	}
	buyerAfter := sale.walletMoney(sale.buyer)
	sale.replayLostNotice(disputeId, 200_000)
	if sale.walletMoney(sale.buyer) != buyerAfter {
		t.Fatal("a duplicate lost notice must not recover twice")
	}
	harness.AssertLedgerHealthy()
}

func TestADuplicateLostNoticeAfterAHeldEscrowWasRecoveredMovesNothing(t *testing.T) {
	sale := startWalletEscrowSale(t, 200_000)
	harness := sale.harness
	disputeId := sale.loseChargeback()
	buyerAfter := sale.walletMoney(sale.buyer)
	sale.replayLostNotice(disputeId, 200_000)
	if sale.walletMoney(sale.buyer) != buyerAfter || harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")) != 0 {
		t.Fatalf("the recovered escrow must not be recovered again: %v", harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}

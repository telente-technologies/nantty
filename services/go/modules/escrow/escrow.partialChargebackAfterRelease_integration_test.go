package escrow

import (
	"context"
	"fmt"
	"testing"

	"zudomart/modules/escrow/src/generated/ent/escrow"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func TestAPartialChargebackOnAReleasedWalletEscrowRecoversOnlyTheDisputedShare(t *testing.T) {
	sale := startWalletEscrowSale(t, 400_000)
	harness := sale.harness
	harness.releaseAfterDelivery(sale.orderId)
	client := harness.escrow.Application.Container.Client(harness.Database)
	released := client.Escrow.Query().Where(escrow.OrderID(sale.orderId)).OnlyX(context.Background())
	sellerBefore, revenueBefore := sale.walletMoney(sale.seller), harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN"))
	chargeback, opened := harness.Flutterwave.OpenChargeback(sale.reference, 100_000)
	if !opened {
		t.Fatal("no chargeback opened")
	}
	gateway := harness.Payments.Application.Gateway
	if _, err := gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		t.Fatal(err)
	}
	harness.Flutterwave.ResolveChargeback(fmt.Sprint(chargeback["id"]), false)
	if _, err := gateway.PollOpenProviderDisputes(context.Background()); err != nil {
		t.Fatal(err)
	}
	harness.RunMoneyWorkers()
	sellerShare := released.ReleasedToSellerMinor * 100_000 / 400_000
	if receivable := harness.balance(ledgermodels.PlatformChargebackReceivableAccount("flutterwave", "NGN")); receivable != 0 {
		t.Fatalf("only the 100_000 the provider took is covered: receivable %d %v", receivable, harness.NonZeroBalances())
	}
	if taken := sellerBefore - sale.walletMoney(sale.seller); taken != sellerShare {
		t.Fatalf("the seller repays only their share of the disputed part: %d, want %d", taken, sellerShare)
	}
	commissionShare := released.CommissionMinor * 100_000 / 400_000
	if reversed := revenueBefore - harness.balance(ledgermodels.PlatformEscrowFeeRevenueAccount("NGN")); reversed != commissionShare {
		t.Fatalf("the escrow fee is reversed only on the disputed part: %d, want %d", reversed, commissionShare)
	}
	if after := client.Escrow.Query().Where(escrow.OrderID(sale.orderId)).OnlyX(context.Background()); after.RefundedMinor != 100_000 {
		t.Fatalf("the escrow records the disputed amount: %d", after.RefundedMinor)
	}
	harness.AssertLedgerHealthy()
}

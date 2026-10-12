package flutterwaveflows

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	affiliateservices "zudomart/modules/creators/src/modules/affiliates/services"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func TestAFailedAffiliateCommissionTransferIsRetriedWithANewReferenceAndPaidOnce(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	scene.creators.Container.Now = func() time.Time { return scene.harness.clock }
	ctx := context.Background()
	sellerBefore := scene.spendable(scene.seller)
	sellerWallet := scene.harness.walletRef(scene.seller)
	orderId := uuid.NewString()
	scene.credit(scene.sale(orderId, 500_000))
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusProcessing {
		t.Fatalf("the commission transfer must be on its way: %+v", row)
	}
	scene.harness.fake.DebitWalletOutsideLedger(sellerWallet, "NGN", 1_000_000)
	scene.harness.runWorkers()
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusPending {
		t.Fatalf("a refused transfer puts the commission back to pending: %+v", row)
	}
	scene.harness.fake.CreditWalletWithoutFee(sellerWallet, 1_000_000, "restore-after-test-debit")
	scene.creators.Affiliates.SettlePendingCommissions(ctx, 10)
	if attempts, _ := scene.harness.gateway.CountMovementsBySubject(ctx, scene.harness.Database, affiliateservices.MovementAffiliateCommission, scene.commission(orderId).ID.String()); attempts != 1 {
		t.Fatalf("no retry before the back-off has passed, got %d transfers", attempts)
	}
	scene.harness.advance(time.Minute)
	for range 2 {
		scene.creators.Affiliates.SettlePendingCommissions(ctx, 10)
		scene.harness.runWorkers()
	}
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusPaid || row.PaidAt == nil {
		t.Fatalf("the retried transfer must pay the commission: %+v", row)
	}
	attempts, err := scene.harness.gateway.CountMovementsBySubject(ctx, scene.harness.Database, affiliateservices.MovementAffiliateCommission, scene.commission(orderId).ID.String())
	if err != nil || attempts != 2 {
		t.Fatalf("one failed and one successful transfer, got %d %v", attempts, err)
	}
	if got := scene.harness.balance(ledgermodels.WalletAvailableAccount(scene.creator, "NGN")); got != 50_000 {
		t.Fatalf("the creator is paid once, got %d", got)
	}
	if paid := sellerBefore - scene.spendable(scene.seller); paid != 50_000 {
		t.Fatalf("the seller pays once, paid %d", paid)
	}
	scene.assertWalletsMatchProvider()
}

func TestACommissionTransferThatKeepsFailingBacksOffAndStopsAfterSixAttempts(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	scene.creators.Container.Now = func() time.Time { return scene.harness.clock }
	ctx := context.Background()
	orderId := uuid.NewString()
	scene.credit(scene.sale(orderId, 500_000))
	scene.harness.fake.DeleteWalletAtProvider(scene.harness.walletRef(scene.seller))
	for range 12 {
		scene.harness.runWorkers()
		scene.harness.advance(time.Hour)
		scene.creators.Affiliates.SettlePendingCommissions(ctx, 10)
	}
	scene.harness.runWorkers()
	attempts, err := scene.harness.gateway.CountMovementsBySubject(ctx, scene.harness.Database, affiliateservices.MovementAffiliateCommission, scene.commission(orderId).ID.String())
	if err != nil || attempts != 6 {
		t.Fatalf("retries must stop at 6 transfers, got %d %v", attempts, err)
	}
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusPending {
		t.Fatalf("the unpaid commission stays visible as pending: %+v", row)
	}
	if got := scene.harness.balance(ledgermodels.WalletAvailableAccount(scene.creator, "NGN")); got != 0 {
		t.Fatalf("nothing reaches the creator, got %d", got)
	}
	scene.harness.AssertLedgerHealthy()
}

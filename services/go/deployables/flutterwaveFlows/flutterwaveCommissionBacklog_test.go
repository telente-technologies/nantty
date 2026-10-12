package flutterwaveflows

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
)

func (scene *affiliateScene) pendingCommission(sellerId string, attempts int, retryAfter *time.Time) string {
	scene.harness.T.Helper()
	orderId := uuid.NewString()
	err := scene.creators.Container.Client(scene.harness.Database).AffiliateCommission.Create().SetOrderID(orderId).SetOrderNumber("ZM-" + orderId[:5]).
		SetOrderItemID(orderId + ":1").SetProductID(scene.productId).SetStoreID(scene.storeId).SetSellerUserID(sellerId).SetCreatorID(scene.creator).
		SetAttributionSource("post").SetAttributionID("p1").SetSaleMinor(500_000).SetCommissionBps(1000).SetCommissionMinor(50_000).SetCurrency("NGN").
		SetTransferAttempts(attempts).SetNillableRetryAfter(retryAfter).Exec(context.Background())
	if err != nil {
		scene.harness.T.Fatal(err)
	}
	return orderId
}

func (scene *affiliateScene) stuckCommissionBacklog() []string {
	brokeSeller := scene.harness.newUser("NG")
	later := scene.harness.clock.Add(time.Hour)
	stuck := []string{}
	for range 120 {
		stuck = append(stuck, scene.pendingCommission(brokeSeller, 0, nil))
	}
	for range 20 {
		stuck = append(stuck, scene.pendingCommission(scene.seller, 6, nil), scene.pendingCommission(scene.seller, 2, &later))
	}
	return stuck
}

func TestCommissionsThatCannotSettleDoNotStarveANewOne(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	scene.creators.Container.Now = func() time.Time { return scene.harness.clock }
	stuck := scene.stuckCommissionBacklog()
	fresh := scene.pendingCommission(scene.seller, 0, nil)
	if settled := scene.creators.Affiliates.SettlePendingCommissions(context.Background(), 50); settled != 1 {
		t.Fatalf("the new commission must settle behind 160 stuck ones, settled %d", settled)
	}
	scene.harness.runWorkers()
	if row := scene.commission(fresh); row.Status != affiliatecommission.StatusPaid || row.TransferAttempts != 1 {
		t.Fatalf("the new commission is paid: %+v", row)
	}
	if got := scene.harness.balance(ledgermodels.WalletAvailableAccount(scene.creator, "NGN")); got != 50_000 {
		t.Fatalf("only the new commission reaches the creator, got %d", got)
	}
	for _, orderId := range stuck {
		if row := scene.commission(orderId); row.Status != affiliatecommission.StatusPending {
			t.Fatalf("a commission out of retries, backing off or without seller funds stays pending: %+v", row)
		}
	}
	scene.assertWalletsMatchProvider()
}

func TestASmallSweepBudgetStillReachesANewCommissionWithinAFewRuns(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	scene.creators.Container.Now = func() time.Time { return scene.harness.clock }
	scene.stuckCommissionBacklog()
	fresh := scene.pendingCommission(scene.seller, 0, nil)
	runs := 0
	for ; runs < 10 && scene.commission(fresh).Status == affiliatecommission.StatusPending; runs++ {
		scene.creators.Affiliates.SettlePendingCommissions(context.Background(), 2)
	}
	if row := scene.commission(fresh); row.Status != affiliatecommission.StatusProcessing || runs > 4 {
		t.Fatalf("each run resumes where the last stopped (40 checks a run over 121 due), got %+v after %d runs", row, runs)
	}
	scene.harness.runWorkers()
	scene.assertWalletsMatchProvider()
}

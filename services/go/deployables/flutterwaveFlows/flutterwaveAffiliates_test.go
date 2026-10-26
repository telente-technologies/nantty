package flutterwaveflows

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	creatorssrc "nantty/modules/creators/src"
	creatorsconfigs "nantty/modules/creators/src/configs"
	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/creatoraffiliation"
	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/repositories"
	"nantty/modules/ledger/src/databases"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

type affiliateScene struct {
	harness                *flowHarness
	creators               *creatorssrc.Module
	seller, creator, buyer string
	storeId, productId     string
}

func startAffiliateScene(t *testing.T, sellerDepositMinor int64) *affiliateScene {
	harness := startFlowHarness(t)
	scene := &affiliateScene{harness: harness, seller: harness.newUser("NG"), creator: harness.newUser("NG"), buyer: uuid.NewString(), storeId: uuid.NewString(), productId: uuid.NewString()}
	harness.verifyToLevelOne(scene.seller)
	harness.verifyToLevelOne(scene.creator)
	if sellerDepositMinor > 0 {
		harness.deposit(scene.seller, sellerDepositMinor)
		harness.runWorkers()
	}
	settings := creatorsconfigs.CreatorsSettings{Money: moneytesting.MoneyModuleSettingsForTests("creators", moneytesting.CreateEmptySchema(t, harness.Database, "creators"), harness.LedgerSchema), DefaultTierId: "starter"}
	module, err := creatorssrc.StartCreatorsModuleWithSettings(context.Background(), settings, harness.Dependencies, harness.Overrides())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = module.Close(context.Background()) })
	if err := module.UsePayments(harness.gateway); err != nil {
		t.Fatal(err)
	}
	module.Container.Directory = repositories.StaticCreatorsDirectory{
		Owners: map[string]string{"post:p1": scene.creator},
		Stores: map[string]repositories.StoreSummary{scene.storeId: {Id: scene.storeId, Name: "Ada Fabrics", OwnerUserId: scene.seller, Currency: "NGN", Active: true}},
	}
	if _, err := module.Program.SetCreatorProgramMembership(context.Background(), programservices.MembershipChange{StaffId: "staff", UserId: scene.creator, TierId: "starter", Status: "approved"}); err != nil {
		t.Fatal(err)
	}
	if err := module.Container.Client(harness.Database).CreatorAffiliation.Create().SetCreatorID(scene.creator).SetStoreID(scene.storeId).SetStatus(creatoraffiliation.StatusActive).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	scene.creators = module
	return scene
}

func (scene *affiliateScene) sale(orderId string, lineMinor int64) affiliateservices.AffiliateSaleReleased {
	bps := int64(1000)
	return affiliateservices.AffiliateSaleReleased{OrderId: orderId, OrderNumber: "ZM-" + orderId[:5], StoreId: scene.storeId, SellerUserId: scene.seller, BuyerUserId: scene.buyer, Currency: "NGN",
		Items: []affiliateservices.AttributedItem{{OrderItemId: orderId + ":1", ProductId: scene.productId, LineTotalMinor: lineMinor, AttributionSource: "post", AttributionId: "p1", CommissionBps: &bps}}}
}

func (scene *affiliateScene) credit(sale affiliateservices.AffiliateSaleReleased) {
	scene.harness.T.Helper()
	for range 2 {
		if _, err := scene.creators.Affiliates.CreditCommissionsForRelease(context.Background(), sale); err != nil {
			scene.harness.T.Fatal(err)
		}
	}
}

func (scene *affiliateScene) refund(orderId string, refundedMinor, orderMinor int64, eventType string) {
	scene.harness.T.Helper()
	refund := affiliateservices.EscrowRefunded{EscrowId: "escrow-" + orderId, OrderId: orderId, Amount: affiliateservices.Money{AmountMinor: orderMinor, Currency: "NGN"},
		Refunded: affiliateservices.Money{AmountMinor: refundedMinor, Currency: "NGN"}}
	for range 2 {
		if _, err := scene.creators.Affiliates.ReverseCommissionsForRefund(context.Background(), refund, eventType); err != nil {
			scene.harness.T.Fatal(err)
		}
	}
}

func (scene *affiliateScene) commission(orderId string) *ent.AffiliateCommission {
	scene.harness.T.Helper()
	row, err := scene.creators.Container.Client(scene.harness.Database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(orderId)).Only(context.Background())
	if err != nil {
		scene.harness.T.Fatal(err)
	}
	return row
}

func (scene *affiliateScene) spendable(userId string) int64 {
	return scene.harness.balance(ledgermodels.WalletAvailableAccount(userId, "NGN")) + scene.harness.balance(ledgermodels.WalletDepositHoldAccount(userId, "NGN"))
}

func (scene *affiliateScene) assertWalletsMatchProvider() {
	scene.harness.runWorkers()
	scene.harness.assertWalletMatchesProvider(scene.seller)
	scene.harness.assertWalletMatchesProvider(scene.creator)
	scene.harness.AssertLedgerHealthy()
}

func TestAffiliateCommissionMovesFromTheSellerWalletToTheCreatorWalletOnce(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	sellerBefore := scene.spendable(scene.seller)
	orderId := uuid.NewString()
	scene.credit(scene.sale(orderId, 500_000))
	scene.harness.runWorkers()
	scene.credit(scene.sale(orderId, 500_000))
	scene.harness.runWorkers()
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusPaid || row.CommissionMinor != 50_000 || row.PaidAt == nil {
		t.Fatalf("the commission must be paid once: %+v", row)
	}
	if got := scene.harness.balance(ledgermodels.WalletAvailableAccount(scene.creator, "NGN")); got != 50_000 {
		t.Fatalf("the creator's own wallet holds the commission, got %d", got)
	}
	if paid := sellerBefore - scene.spendable(scene.seller); paid != 50_000 {
		t.Fatalf("the seller's wallet pays it once, paid %d", paid)
	}
	if platformOwed := scene.harness.balance(ledgermodels.CreatorEarningsPayableAccount(scene.creator, "NGN")); platformOwed != 0 {
		t.Fatalf("no platform-held earnings for affiliates: %d", platformOwed)
	}
	scene.assertWalletsMatchProvider()
}

func TestAffiliateCommissionWaitsForSellerFundsAndAReversalBeforePayoutMovesNoMoney(t *testing.T) {
	scene := startAffiliateScene(t, 0)
	full, partial := uuid.NewString(), uuid.NewString()
	scene.credit(scene.sale(full, 500_000))
	scene.credit(scene.sale(partial, 500_000))
	if row := scene.commission(full); row.Status != affiliatecommission.StatusPending {
		t.Fatalf("with an empty seller wallet the commission waits: %+v", row)
	}
	scene.refund(full, 500_000, 500_000, "escrow.refunded")
	scene.refund(partial, 250_000, 500_000, "escrow.partiallyRefunded")
	if row := scene.commission(full); row.Status != affiliatecommission.StatusReversed || row.ReversedMinor != 50_000 {
		t.Fatalf("a full refund before payout cancels the commission: %+v", row)
	}
	scene.harness.deposit(scene.seller, 1_000_000)
	scene.harness.runWorkers()
	sellerBefore := scene.spendable(scene.seller)
	if settled := scene.creators.Affiliates.SettlePendingCommissions(context.Background(), 10); settled != 1 {
		t.Fatalf("only the partly refunded commission is still owed, settled %d", settled)
	}
	scene.harness.runWorkers()
	if got := scene.harness.balance(ledgermodels.WalletAvailableAccount(scene.creator, "NGN")); got != 25_000 {
		t.Fatalf("the creator receives what is left after the refund, got %d", got)
	}
	if paid := sellerBefore - scene.spendable(scene.seller); paid != 25_000 {
		t.Fatalf("the seller pays only the remaining commission, paid %d", paid)
	}
	scene.assertWalletsMatchProvider()
}

func TestAffiliateCommissionIsClawedBackAfterPayoutAndAShortfallBecomesCreatorDebt(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	covered, spent := uuid.NewString(), uuid.NewString()
	scene.credit(scene.sale(covered, 500_000))
	scene.credit(scene.sale(spent, 500_000))
	scene.harness.runWorkers()
	sellerBefore := scene.spendable(scene.seller)
	scene.refund(covered, 500_000, 500_000, "escrow.refunded")
	scene.harness.runWorkers()
	if row := scene.commission(covered); row.Status != affiliatecommission.StatusReversed {
		t.Fatalf("a refunded paid commission is reversed: %+v", row)
	}
	if back := scene.spendable(scene.seller) - sellerBefore; back != 50_000 {
		t.Fatalf("the seller gets the commission back from the creator's wallet, got %d", back)
	}
	if left := scene.spendable(scene.creator); left != 50_000 {
		t.Fatalf("the creator keeps only the other commission, left %d", left)
	}
	if spentByCreator := scene.fundAdsFromCreatorWallet(30_000); spentByCreator >= 300 {
		t.Fatalf("the creator spends part of the commission on ads: %d", spentByCreator)
	}
	scene.harness.runWorkers()
	scene.harness.fake.FundMainBalance("NGN", 1_000_000)
	sellerBefore = scene.spendable(scene.seller)
	scene.refund(spent, 500_000, 500_000, "escrow.refunded")
	for range 2 {
		scene.harness.runWorkers()
		scene.harness.advance(time.Minute)
	}
	scene.harness.runWorkers()
	if debt := scene.harness.balance(ledgermodels.WalletDebtAccount(scene.creator, "NGN")); debt != 30_000 {
		t.Fatalf("what the creator already spent becomes their wallet debt, debt %d", debt)
	}
	if back := scene.spendable(scene.seller) - sellerBefore; back != 50_000 {
		t.Fatalf("the seller is made whole (20,000 from the creator, 30,000 topped up), got %d", back)
	}
	scene.assertWalletsMatchProvider()
}

func (scene *affiliateScene) fundAdsFromCreatorWallet(amountMinor int64) int {
	return scene.harness.fundAdsFromWallet(scene.creator, "aff-ads-"+uuid.NewString()[:8], amountMinor).Status
}

func TestAReversalWhileTheCommissionIsInFlightIsClawedBackOnceItLands(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	orderId := uuid.NewString()
	scene.credit(scene.sale(orderId, 500_000))
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusProcessing {
		t.Fatalf("the commission transfer is in flight: %+v", row)
	}
	sellerBefore := scene.spendable(scene.seller)
	scene.refund(orderId, 500_000, 500_000, "escrow.refunded")
	scene.harness.runWorkers()
	if row := scene.commission(orderId); row.Status != affiliatecommission.StatusReversed {
		t.Fatalf("once it lands the deferred refund reverses it: %+v", row)
	}
	if left := scene.spendable(scene.creator); left != 0 {
		t.Fatalf("the creator keeps nothing, left %d", left)
	}
	if back := scene.spendable(scene.seller) - sellerBefore; back != 50_000 {
		t.Fatalf("the seller gets the commission back, got %d", back)
	}
	scene.assertWalletsMatchProvider()
}

func TestARefundInsideTheEscrowWindowMeansNoCommissionIsEverPaid(t *testing.T) {
	scene := startAffiliateScene(t, 1_000_000)
	orderId := uuid.NewString()
	scene.refund(orderId, 500_000, 500_000, "escrow.refunded")
	completed := affiliateservices.OrderGroupCompleted{OrderGroupId: orderId, StoreId: scene.storeId, SellerAccountId: scene.seller, BuyerAccountId: scene.buyer, Currency: "NGN",
		SubtotalMinor: 500_000, RefundedMinor: 500_000, AttributedItems: scene.sale(orderId, 500_000).Items}
	scene.credit(completed.Sale())
	scene.harness.runWorkers()
	if count, _ := scene.creators.Container.Client(scene.harness.Database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(orderId)).Count(context.Background()); count != 0 {
		t.Fatalf("a fully refunded order pays no commission, rows %d", count)
	}
	if got := scene.spendable(scene.creator); got != 0 {
		t.Fatalf("the creator receives nothing, got %d", got)
	}
}

func TestAPlatformCreditWithALongSubjectStillReachesTheWallet(t *testing.T) {
	harness := startFlowHarness(t)
	user := harness.newUser("NG")
	harness.verifyToLevelOne(user)
	harness.fake.FundMainBalance("NGN", 100_000)
	subject := "ads:ad-earnings-refund:" + user + ":" + strings.Repeat("k", 120)
	err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return harness.gateway.CreditWalletFromPlatformInTransaction(ctx, transaction, user, "NGN", subject, "long-subject-"+user, 12_345,
			ledgermodels.PaymentsAwaitingApplicationAccount("NGN"), "Unused ad credit returned")
	})
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		harness.runWorkers()
		harness.advance(time.Minute)
	}
	harness.runWorkers()
	if got := harness.balance(ledgermodels.WalletAvailableAccount(user, "NGN")); got != 12_345 {
		t.Fatalf("a long credit subject must still settle into the wallet, got %d", got)
	}
}

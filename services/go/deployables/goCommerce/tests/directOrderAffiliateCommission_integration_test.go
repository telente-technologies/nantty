package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"

	creatorssrc "nantty/modules/creators/src"
	creatorsconfigs "nantty/modules/creators/src/configs"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/creatoraffiliation"
	creatorsmigrations "nantty/modules/creators/src/migrations"
	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/repositories"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/loaders"
	ledgermigrations "nantty/modules/ledger/src/migrations"
	"nantty/modules/orders/src/generated/ent/cartitem"
	"nantty/modules/orders/src/generated/ent/outboxevent"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/servicemodule"
)

func startCreatorsForOrders(t *testing.T, storeId, sellerId, creatorId, productId string) *creatorssrc.Module {
	t.Helper()
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	ledgerSchema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "ledger", ledgermigrations.Files)
	settings := creatorsconfigs.CreatorsSettings{Money: moneytesting.MoneyModuleSettingsForTests("creators", moneytesting.CreateFreshSchemaWithMigrations(t, database, "creators", creatorsmigrations.Files), ledgerSchema), DefaultTierId: "starter"}
	tokens := moneytesting.NewTestTokenAuthority(t)
	module, err := creatorssrc.StartCreatorsModuleWithSettings(context.Background(), settings, servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Health: health.NewRegistryForService("orders-creators")},
		loaders.MoneyModuleOverrides{Publisher: &events.RecordingPublisher{}, AccessVerifier: tokens.UserVerifier(), StaffVerifiers: tokens.StaffVerifiers()})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = module.Close(context.Background()) })
	store := repositories.StoreSummary{Id: storeId, Name: "Ada Fabrics", OwnerUserId: sellerId, Currency: "NGN", Active: true}
	module.Container.Directory = repositories.StaticCreatorsDirectory{
		Stores:   map[string]repositories.StoreSummary{storeId: store},
		Products: map[string]repositories.ProductSummary{productId: {Id: productId, StoreId: storeId, Name: "Ankara dress", PriceMinor: 100, Currency: "NGN", Published: true}},
		Users:    map[string]repositories.UserSummary{creatorId: {Id: creatorId, Username: "ada"}},
	}
	if _, err := module.Program.SetCreatorProgramMembership(context.Background(), programservices.MembershipChange{StaffId: "staff", UserId: creatorId, TierId: "starter", Status: "approved"}); err != nil {
		t.Fatal(err)
	}
	enabled, bps := true, int64(1000)
	if _, err := module.Affiliates.UpdateSettings(context.Background(), store, affiliateservices.SettingsChange{Enabled: &enabled, DefaultCommissionBps: &bps}); err != nil {
		t.Fatal(err)
	}
	module.Container.Client(database).CreatorAffiliation.Create().SetCreatorID(creatorId).SetStoreID(storeId).SetStatus(creatoraffiliation.StatusActive).ExecX(context.Background())
	return module
}

func (harness *commerceHarness) eventData(t *testing.T, eventType string, orderId uuid.UUID, into any) {
	t.Helper()
	row := harness.orders.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType(eventType), outboxevent.Subject(orderId.String())).OnlyX(context.Background())
	if err := json.Unmarshal(eventPayload(t, row.Payload), into); err != nil {
		t.Fatal(err)
	}
}

func TestAnAutoCompletedDirectOrderCreditsTheAffiliateCommissionOnce(t *testing.T) {
	harness, clock, deliveredAt := startDirectOrderHarness(t)
	ctx := context.Background()
	creatorId, productId := uuid.NewString(), harness.productId(t)
	harness.fillCart(t, 1)
	link := uuid.New()
	harness.orders.Container.Client.CartItem.Update().Where(cartitem.ProductID(uuid.MustParse(productId))).SetAttributionSource("link").SetAttributionID(link).SetAttributedAt(deliveredAt.Add(-time.Hour)).ExecX(ctx)
	orderId := harness.deliveredDirectOrderFromCurrentCart(t, deliveredAt)
	group := harness.orders.Container.Client.OrderGroup.GetX(ctx, orderId)
	creators := startCreatorsForOrders(t, group.StoreID.String(), group.SellerAccountID.String(), creatorId, productId)
	creators.Container.Client(creators.Container.Resources.Database).AffiliateLink.Create().SetID(link).SetCreatorID(creatorId).SetStoreID(group.StoreID.String()).SetProductID(productId).ExecX(ctx)
	var paid affiliateservices.OrderGroupPaid
	harness.eventData(t, "orderGroup.paid", orderId, &paid)
	if recorded, err := creators.Affiliates.RecordAwaitingAttributedSales(ctx, paid.Sale()); err != nil || recorded != 1 {
		t.Fatalf("the paid direct order shows a pending commission: %d %v", recorded, err)
	}
	clock.set(deliveredAt.Add(72 * time.Hour))
	if completed := harness.sweepDirectOrders(t); completed != 1 {
		t.Fatalf("auto-completion: %d", completed)
	}
	var completed affiliateservices.OrderGroupCompleted
	harness.eventData(t, "orderGroup.completed", orderId, &completed)
	for range 2 {
		if _, err := creators.Affiliates.CreditCommissionsForRelease(ctx, completed.Sale()); err != nil {
			t.Fatal(err)
		}
	}
	commissions := creators.Container.Client(creators.Container.Resources.Database).AffiliateCommission.Query().Where(affiliatecommission.OrderID(orderId.String())).AllX(ctx)
	if len(commissions) != 1 || commissions[0].CommissionMinor != group.SubtotalMinor/10 || commissions[0].CreatorID != creatorId || commissions[0].OrderNumber != group.Reference {
		t.Fatalf("one 10%% commission for the auto-completed direct order: %+v (subtotal %d)", commissions, group.SubtotalMinor)
	}
}

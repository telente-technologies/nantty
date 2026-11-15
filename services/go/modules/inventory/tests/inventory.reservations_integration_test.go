package inventory_test

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/inventory/src"
	"nantty/modules/inventory/src/configs"
	"nantty/modules/inventory/src/generated/ent/stocklevel"
	"nantty/modules/inventory/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/config"
	"nantty/platform/health"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
)

func startInventoryAgainstFreshSchema(t *testing.T) *src.Module {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test")
	}
	databaseUrl := os.Getenv("INVENTORY_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://nantty:nantty@localhost:15432/nantty_test?sslmode=disable"
	}
	ctx := context.Background()
	admin, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("inventory_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, admin, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
		_ = admin.Close()
	})
	settings := configs.ReadInventorySettingsFromEnvironment(config.NewEnvironmentReader())
	settings.DatabaseUrl, settings.DatabaseSchema, settings.Environment = databaseUrl, schema, "test"
	dependencies := servicemodule.Dependencies{DeployableName: "test", Logger: slog.Default(), Environment: config.NewEnvironmentReader(), Health: health.NewRegistryForService("test")}
	module, err := src.StartInventoryModuleWithSettings(ctx, settings, src.Collaborators{}, dependencies)
	if err != nil {
		t.Fatalf("start inventory: %v", err)
	}
	t.Cleanup(func() { _ = module.Close(ctx) })
	return module
}

func provisionStock(t *testing.T, module *src.Module, storeId uuid.UUID, onHand ...int) (uuid.UUID, []uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	variantId, productId := uuid.New(), uuid.New()
	locationIds := make([]uuid.UUID, 0, len(onHand))
	for index, quantity := range onHand {
		location, err := module.Container.Client.StockLocation.Create().SetStoreID(storeId).SetName(fmt.Sprintf("Location %d", index)).SetIsDefault(index == 0).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
		locationIds = append(locationIds, location.ID)
		if _, err := module.Container.Client.StockLevel.Create().SetStoreID(storeId).SetProductID(productId).SetVariantID(variantId).SetLocationID(location.ID).SetOnHand(quantity).Save(ctx); err != nil {
			t.Fatal(err)
		}
	}
	return variantId, locationIds
}

func TestConcurrentCheckoutsNeverReserveMoreThanAvailable(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	storeId := uuid.New()
	variantId, _ := provisionStock(t, module, storeId, 12, 8)
	reservations := services.ReservationService{Container: module.Container}
	var succeeded, rejected atomic.Int64
	var group sync.WaitGroup
	for attempt := 0; attempt < 60; attempt++ {
		group.Add(1)
		go func() {
			defer group.Done()
			err := reservations.Reserve(context.Background(), commerceports.ReserveStockRequest{
				Reference: uuid.NewString(), ExpiresAt: time.Now().Add(time.Hour), Lines: []commerceports.StockLine{{VariantId: variantId, StoreId: storeId, Quantity: 1}},
			})
			var shortage commerceports.InsufficientStockError
			switch {
			case err == nil:
				succeeded.Add(1)
			case asInsufficient(err, &shortage):
				rejected.Add(1)
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}()
	}
	group.Wait()
	if succeeded.Load() != 20 || rejected.Load() != 40 {
		t.Fatalf("succeeded=%d rejected=%d, want 20 and 40", succeeded.Load(), rejected.Load())
	}
	levels, err := module.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(variantId)).All(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, level := range levels {
		if level.Reserved > level.OnHand {
			t.Fatalf("level reserved %d above on hand %d", level.Reserved, level.OnHand)
		}
		total += level.Reserved
	}
	if total != 20 {
		t.Fatalf("reserved total = %d, want 20", total)
	}
}

func TestReservationLifecycleReserveConfirmFulfilAndRelease(t *testing.T) {
	module := startInventoryAgainstFreshSchema(t)
	ctx := context.Background()
	storeId := uuid.New()
	variantId, locations := provisionStock(t, module, storeId, 10)
	reservations := services.ReservationService{Container: module.Container}
	lines := []commerceports.StockLine{{VariantId: variantId, StoreId: storeId, Quantity: 4}}
	request := commerceports.ReserveStockRequest{Reference: "checkout-a", ExpiresAt: time.Now().Add(time.Hour), Lines: lines}
	for repeat := 0; repeat < 2; repeat++ {
		if err := reservations.Reserve(ctx, request); err != nil {
			t.Fatalf("reserve attempt %d: %v", repeat, err)
		}
	}
	if err := reservations.Confirm(ctx, "checkout-a"); err != nil {
		t.Fatal(err)
	}
	if err := reservations.Confirm(ctx, "checkout-a"); err != nil {
		t.Fatalf("confirming an already-confirmed reservation is a safe retry: %v", err)
	}
	if err := reservations.Fulfil(ctx, commerceports.FulfilStockRequest{Reference: "checkout-a", StoreId: storeId, ActorName: "seller"}); err != nil {
		t.Fatal(err)
	}
	level := module.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(variantId), stocklevel.LocationID(locations[0])).OnlyX(ctx)
	if level.OnHand != 6 || level.Reserved != 0 {
		t.Fatalf("after shipping onHand=%d reserved=%d, want 6 and 0", level.OnHand, level.Reserved)
	}
	if err := reservations.Reserve(ctx, commerceports.ReserveStockRequest{Reference: "checkout-b", ExpiresAt: time.Now().Add(-time.Minute), Lines: lines}); err != nil {
		t.Fatal(err)
	}
	if expired, err := reservations.ExpireDueReservations(ctx, 10); err != nil || expired != 1 {
		t.Fatalf("expired=%d err=%v, want 1", expired, err)
	}
	level = module.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(variantId)).OnlyX(ctx)
	if level.OnHand != 6 || level.Reserved != 0 {
		t.Fatalf("after expiry onHand=%d reserved=%d, want 6 and 0", level.OnHand, level.Reserved)
	}
}

package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	catalogsrc "zudomart/modules/catalog/src"
	catalogconfigs "zudomart/modules/catalog/src/configs"
	inventorysrc "zudomart/modules/inventory/src"
	inventoryconfigs "zudomart/modules/inventory/src/configs"
	"zudomart/modules/inventory/src/generated/ent/stocklevel"
	"zudomart/modules/inventory/src/generated/ent/stockreservation"
	orderssrc "zudomart/modules/orders/src"
	ordersconfigs "zudomart/modules/orders/src/configs"
	ordersent "zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/cart"
	"zudomart/modules/orders/src/generated/ent/checkout"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/integrations"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/commerceports"
	"zudomart/platform/config"
	"zudomart/platform/health"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/usersdirectory"
)

type commerceHarness struct {
	orders    *orderssrc.Module
	inventory *inventorysrc.Module
	money     *integrations.InMemoryCheckoutMoney
	buyer     uuid.UUID
	variantId uuid.UUID
	storeId   uuid.UUID
	addressId uuid.UUID
}

func schemaName(prefix string) string {
	return fmt.Sprintf("%s_test_%d", prefix, time.Now().UnixNano())
}

func startCommerce(t *testing.T) *commerceHarness {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test")
	}
	databaseUrl := os.Getenv("COMMERCE_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
	}
	ctx := context.Background()
	admin, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schemas := map[string]string{"catalog": schemaName("catalog"), "inventory": schemaName("inventory"), "orders": schemaName("orders"), "users": schemaName("users")}
	for _, schema := range schemas {
		if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, admin, schema); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		for _, schema := range schemas {
			_, _ = admin.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
		}
		_ = admin.Close()
	})
	createMinimalUsersTables(t, admin, schemas["users"])
	dependencies := servicemodule.Dependencies{DeployableName: "test", Logger: slog.Default(), Environment: config.NewEnvironmentReader(), Health: health.NewRegistryForService("test")}
	reader := config.NewEnvironmentReader()
	catalogSettings := catalogconfigs.ReadCatalogSettingsFromEnvironment(reader)
	catalogSettings.DatabaseUrl, catalogSettings.DatabaseSchema, catalogSettings.Environment = databaseUrl, schemas["catalog"], "test"
	catalogModule, err := catalogsrc.StartCatalogModuleWithSettings(ctx, catalogSettings, catalogsrc.Collaborators{}, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	inventorySettings := inventoryconfigs.ReadInventorySettingsFromEnvironment(reader)
	inventorySettings.DatabaseUrl, inventorySettings.DatabaseSchema, inventorySettings.Environment = databaseUrl, schemas["inventory"], "test"
	inventoryModule, err := inventorysrc.StartInventoryModuleWithSettings(ctx, inventorySettings, inventorysrc.Collaborators{}, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	fakeMoney := integrations.NewInMemoryCheckoutMoney()
	ordersSettings := ordersconfigs.ReadOrdersSettingsFromEnvironment(reader)
	ordersSettings.DatabaseUrl, ordersSettings.DatabaseSchema, ordersSettings.Environment = databaseUrl, schemas["orders"], "test"
	ordersModule, err := orderssrc.StartOrdersModuleWithSettings(ctx, ordersSettings, orderssrc.Collaborators{Money: fakeMoney}, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = ordersModule.Close(ctx)
		_ = inventoryModule.Close(ctx)
		_ = catalogModule.Close(ctx)
	})
	ordersModule.Container.Users = usersdirectory.Reader{Database: ordersModule.Container.Database, Schema: schemas["users"]}
	harness := &commerceHarness{orders: ordersModule, inventory: inventoryModule, money: fakeMoney, buyer: uuid.New()}
	harness.seed(t, catalogModule, admin, schemas["users"])
	return harness
}

func createMinimalUsersTables(t *testing.T, admin *sql.DB, schema string) {
	t.Helper()
	q := pgx.Identifier{schema}.Sanitize() + "."
	statements := []string{
		"CREATE TABLE " + q + "geo_regions (id uuid PRIMARY KEY, country_code text, code text, name text)",
		"CREATE TABLE " + q + "geo_admin_areas (id uuid PRIMARY KEY, region_id uuid, name text)",
		"CREATE TABLE " + q + "geo_cities (id uuid PRIMARY KEY, name text)",
		"CREATE TABLE " + q + "profiles (id uuid PRIMARY KEY, account_id uuid, kind text, handle text, display_name text, avatar_url text, verified bool, country_code text, status text)",
		"CREATE TABLE " + q + "privacy_settings (account_id uuid PRIMARY KEY, analytics bool, personalization bool)",
		"CREATE TABLE " + q + `shipping_addresses (id uuid PRIMARY KEY, account_id uuid, recipient_name text, phone text, line1 text, line2 text, postal_code text, details text,
			country_code text, region_id uuid, admin_area_id uuid, city_id uuid, free_text_city text, free_text_state text)`,
	}
	for _, statement := range statements {
		if _, err := admin.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
}

func (harness *commerceHarness) seed(t *testing.T, catalogModule *catalogsrc.Module, admin *sql.DB, usersSchema string) {
	t.Helper()
	ctx := context.Background()
	q := pgx.Identifier{usersSchema}.Sanitize() + "."
	regionId, sellerId := uuid.New(), uuid.New()
	harness.addressId = uuid.New()
	for _, statement := range []struct {
		sql  string
		args []any
	}{
		{"INSERT INTO " + q + "geo_regions VALUES ($1, 'NG', 'OG', 'Ogun')", []any{regionId}},
		{"INSERT INTO " + q + "profiles VALUES ($1, $2, 'personal', 'buyer', 'Buyer One', NULL, false, 'NG', 'active')", []any{uuid.New(), harness.buyer}},
		{"INSERT INTO " + q + `shipping_addresses VALUES ($1, $2, 'Buyer One', '+2348000000000', '1 Road', '', '', '', 'NG', $3, NULL, NULL, '', '')`, []any{harness.addressId, harness.buyer, regionId}},
	} {
		if _, err := admin.ExecContext(ctx, statement.sql, statement.args...); err != nil {
			t.Fatal(err)
		}
	}
	store, err := catalogModule.Container.Client.Store.Create().SetOwnerAccountID(sellerId).SetBusinessProfileID(uuid.New()).SetName("Test Store").SetSlug("test-store").SetCountryCode("NG").SetCurrency("NGN").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	harness.storeId = store.ID
	product, err := catalogModule.Container.Client.Product.Create().SetStoreID(store.ID).SetName("Shirt").SetStatus("active").SetPublishedOnline(true).SetCurrency("NGN").SetMinPriceMinor(500000).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	variant, err := catalogModule.Container.Client.ProductVariant.Create().SetProductID(product.ID).SetStoreID(store.ID).SetTitle("Default").SetSku("SHIRT").SetSkuKey("shirt").SetPriceMinor(500000).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	harness.variantId = variant.ID
	stock, _ := commerceports.Default.InventoryStock()
	locationId, err := stock.EnsureDefaultLocation(ctx, store.ID, "NG")
	if err != nil {
		t.Fatal(err)
	}
	if err := stock.ProvisionVariantStock(ctx, commerceports.ProvisionVariantStockRequest{StoreId: store.ID, ProductId: product.ID, VariantId: variant.ID, Listed: true, LowStockLevel: 1,
		ReorderPoint: 1, ReorderQuantity: 1, Opening: []commerceports.OpeningStock{{LocationId: locationId, Quantity: 5}}, ActorAccountId: sellerId, MovementRefToken: "seed"}); err != nil {
		t.Fatal(err)
	}
	profile := harness.orders.Container.Client.ShippingProfile.Create().SetStoreID(store.ID).SetName("Standard").SetCurrency("NGN").SetIsDefault(true).SaveX(ctx)
	zone := harness.orders.Container.Client.ShippingZone.Create().SetProfileID(profile.ID).SetName("Nationwide").SaveX(ctx)
	harness.orders.Container.Client.ShippingDestination.Create().SetZoneID(zone.ID).SetCountryCode("NG").ExecX(ctx)
	harness.orders.Container.Client.ShippingRule.Create().SetZoneID(zone.ID).SetFeeMinor(100000).ExecX(ctx)
}

func (harness *commerceHarness) fillCart(t *testing.T, quantity int) {
	t.Helper()
	ctx := context.Background()
	client := harness.orders.Container.Client
	row, err := client.Cart.Query().Where(cart.AccountID(harness.buyer)).Only(ctx)
	if ordersent.IsNotFound(err) {
		row = client.Cart.Create().SetAccountID(harness.buyer).SaveX(ctx)
	}
	client.CartItem.Delete().ExecX(ctx)
	snapshots, err := mustCatalog().ResolveProductsForCheckout(ctx, []uuid.UUID{harness.variantId})
	if err != nil {
		t.Fatal(err)
	}
	client.CartItem.Create().SetCartID(row.ID).SetProductID(snapshots[harness.variantId].ProductId).SetVariantID(harness.variantId).SetStoreID(harness.storeId).SetQuantity(quantity).ExecX(ctx)
}

func mustCatalog() commerceports.CatalogReader {
	catalog, _ := commerceports.Default.CatalogReader()
	return catalog
}

func (harness *commerceHarness) reservedUnits(t *testing.T) int {
	t.Helper()
	levels := harness.inventory.Container.Client.StockLevel.Query().Where(stocklevel.VariantID(harness.variantId)).AllX(context.Background())
	total := 0
	for _, level := range levels {
		total += level.Reserved
	}
	return total
}

func TestCheckoutReservesStockAndCreatesOrdersInOneTransaction(t *testing.T) {
	harness := startCommerce(t)
	ctx := context.Background()
	harness.fillCart(t, 2)
	result, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "checkout-key-0001"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.OrderGroups) != 1 || result.Total.AmountMinor != 1_100_000 {
		t.Fatalf("unexpected result %+v", result)
	}
	if harness.reservedUnits(t) != 2 || len(harness.money.Payables) != 1 {
		t.Fatalf("reserved=%d payables=%d", harness.reservedUnits(t), len(harness.money.Payables))
	}
}

func TestCheckoutShortageRollsBackOrdersAndLeavesNoReservation(t *testing.T) {
	harness := startCommerce(t)
	ctx := context.Background()
	harness.fillCart(t, 9)
	_, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "checkout-key-0002"})
	if err == nil {
		t.Fatal("expected insufficient stock")
	}
	if harness.orders.Container.Client.Checkout.Query().CountX(ctx) != 0 || harness.orders.Container.Client.OrderGroup.Query().CountX(ctx) != 0 {
		t.Fatal("a failed reservation must not leave a checkout or order behind")
	}
	if harness.reservedUnits(t) != 0 || harness.inventory.Container.Client.StockReservation.Query().CountX(ctx) != 0 {
		t.Fatal("a failed checkout must not leave stock reserved")
	}
}

func TestPaymentRegistrationFailureCompensatesTheReservation(t *testing.T) {
	harness := startCommerce(t)
	ctx := context.Background()
	harness.fillCart(t, 3)
	harness.money.Fail = fmt.Errorf("money service unavailable")
	_, err := (services.CheckoutService{Container: harness.orders.Container}).Checkout(ctx, services.CheckoutRequest{BuyerId: harness.buyer, AddressId: harness.addressId, IdempotencyKey: "checkout-key-0003"})
	if err == nil {
		t.Fatal("expected the payment service failure to surface")
	}
	row := harness.orders.Container.Client.Checkout.Query().Where(checkout.IdempotencyKey("checkout-key-0003")).OnlyX(ctx)
	if row.Status != "failed" {
		t.Fatalf("checkout status = %s, want failed", row.Status)
	}
	group := harness.orders.Container.Client.OrderGroup.Query().Where(ordergroup.CheckoutID(row.ID)).OnlyX(ctx)
	if group.Status != "cancelled" {
		t.Fatalf("order group status = %s, want cancelled", group.Status)
	}
	if harness.reservedUnits(t) != 0 {
		t.Fatalf("reserved units = %d, the reservation must be released", harness.reservedUnits(t))
	}
	released := harness.inventory.Container.Client.StockReservation.Query().Where(stockreservation.Reference(group.ID.String()), stockreservation.Status("released")).CountX(ctx)
	if released != 1 {
		t.Fatalf("released reservations = %d, want 1", released)
	}
}

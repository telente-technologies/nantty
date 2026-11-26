package analytics_test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"nantty/modules/analytics/src/migrations"
	"nantty/modules/analytics/src/services"
	"nantty/modules/analytics/src/store"
	"nantty/modules/analytics/src/types"
	"nantty/platform/postgres"
)

func TestAnalyticsPostgresMigrationIngestSummaryAndRetention(t *testing.T) {
	databaseURL := os.Getenv("ANALYTICS_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set ANALYTICS_TEST_DATABASE_URL to a disposable PostgreSQL test database")
	}
	ctx := context.Background()
	admin, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseURL, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatalf("open disposable PostgreSQL database: %v", err)
	}
	schema := fmt.Sprintf("analytics_integration_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, admin, schema); err != nil {
		_ = admin.Close()
		t.Fatalf("create isolated analytics schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.ExecContext(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		_ = admin.Close()
	})
	scopedURL, err := postgres.ScopeDatabaseUrlToSchema(databaseURL, schema)
	if err != nil {
		t.Fatal(err)
	}
	if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedURL, migrations.Files, "."); err != nil {
		t.Fatalf("apply embedded analytics migration: %v", err)
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedURL, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatalf("open migrated analytics schema: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	now := time.Date(2026, 11, 26, 12, 0, 0, 0, time.UTC)
	service := services.Service{Store: &store.PostgresStore{Database: database}, Now: func() time.Time { return now }, MaxBatchSize: 50}
	storeA, storeB := "store-a", "store-b"
	events := []types.IngestEventInput{
		{EventKey: "store-a-view", Domain: "commerce", EventName: "product.viewed", StoreId: storeA},
		{EventKey: "store-a-order", Domain: "commerce", EventName: "order.completed", StoreId: storeA, AmountMinor: 12500, Currency: "ngn"},
		{EventKey: "store-b-order", Domain: "commerce", EventName: "order.completed", StoreId: storeB, AmountMinor: 90000, Currency: "NGN"},
		{EventKey: "old-event", Domain: "commerce", EventName: "cart.added", StoreId: storeA, OccurredAt: timePointer(now.AddDate(0, 0, -31))},
	}
	result, err := service.IngestInternalBatch(ctx, events)
	if err != nil || result.Accepted != len(events) || result.Ignored != 0 {
		t.Fatalf("internal ingest = %+v, %v", result, err)
	}
	replay, err := service.IngestInternalBatch(ctx, []types.IngestEventInput{{
		EventKey: "store-a-order", Domain: "commerce", EventName: "order.completed", StoreId: storeA, AmountMinor: 999999, Currency: "NGN",
	}})
	if err != nil || replay.Accepted != 0 || replay.Ignored != 1 {
		t.Fatalf("duplicate event replay = %+v, %v", replay, err)
	}
	summary, err := service.SellerSummary(ctx, storeA, "30d")
	if err != nil || summary.ProductViews != 1 || summary.Orders != 1 || summary.GrossSalesMinor != 12500 || summary.ConversionRate != 1 {
		t.Fatalf("store A summary = %+v, %v", summary, err)
	}
	purged, err := service.Store.PurgeBefore(ctx, now.AddDate(0, 0, -30))
	if err != nil || purged != 1 {
		t.Fatalf("retention purge = %d, %v; want one expired event", purged, err)
	}
}

func timePointer(value time.Time) *time.Time { return &value }

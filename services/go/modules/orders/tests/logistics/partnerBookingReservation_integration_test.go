package logistics_test

import (
	"context"
	"database/sql"
	"errors"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/orders/src/logistics"
	"nantty/modules/orders/src/modules/partnerLogistics/store"
)

func TestPartnerBookingReservesBeforeCarrierCall(t *testing.T) {
	databaseURL := os.Getenv("ORDERS_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("ORDERS_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "booking_test_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE") })
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	parameters := parsed.Query()
	parameters.Set("search_path", schema)
	parsed.RawQuery = parameters.Encode()
	db, err := sql.Open("pgx", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(4)
	for _, statement := range []string{
		`CREATE TABLE delivery_quotes (id uuid PRIMARY KEY, store_id uuid, order_group_id uuid, status text, expires_at timestamptz, updated_at timestamptz)`,
		`CREATE TABLE shipments (id uuid PRIMARY KEY, created_at timestamptz, order_group_id uuid UNIQUE, store_id uuid, provider text, provider_reference text, quote_id uuid, status text, service_type text, pickup_address jsonb, destination_address jsonb, tracking_number text, booked_at timestamptz, estimated_delivery_at timestamptz, updated_at timestamptz)`,
		`CREATE TABLE parcels (id uuid PRIMARY KEY, created_at timestamptz, shipment_id uuid, weight_grams integer, package_count integer, contents_description text, declared_value_minor bigint, currency text, updated_at timestamptz)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	storeId, orderId, quoteId := uuid.New(), uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO delivery_quotes (id, store_id, order_group_id, status, expires_at) VALUES ($1, $2, $3, 'quoted', now() + interval '1 hour')`, quoteId, storeId, orderId); err != nil {
		t.Fatal(err)
	}
	resource := store.PartnerLogisticsStore{Database: db}
	quote := store.QuoteRecord{Id: quoteId, StoreId: storeId, OrderGroupId: &orderId}
	parcel := logistics.Parcel{WeightGrams: 500, PackageCount: 1, DeclaredValueMinor: 1000, Currency: "NGN"}
	var wg sync.WaitGroup
	errorsCh := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errorsCh <- resource.ReserveShipment(ctx, store.ShipmentRecord{Id: uuid.New(), StoreId: storeId, OrderGroupId: orderId, Provider: "kwikpik"}, quote, parcel)
		}()
	}
	wg.Wait()
	close(errorsCh)
	var accepted, rejected int
	for err := range errorsCh {
		if err == nil {
			accepted++
		} else if errors.Is(err, store.ErrQuoteAlreadyUsed) {
			rejected++
		} else {
			t.Fatalf("unexpected reservation error: %v", err)
		}
	}
	if accepted != 1 || rejected != 1 {
		t.Fatalf("accepted=%d rejected=%d, want one each", accepted, rejected)
	}
	var shipmentId uuid.UUID
	var status string
	if err := db.QueryRowContext(ctx, `SELECT id, status FROM shipments WHERE order_group_id = $1`, orderId).Scan(&shipmentId, &status); err != nil || status != "booking_pending" {
		t.Fatalf("shipment reservation missing or wrong status: status=%q err=%v", status, err)
	}
	var parcelCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM parcels WHERE shipment_id = $1`, shipmentId).Scan(&parcelCount); err != nil || parcelCount != 1 {
		t.Fatalf("parcelCount=%d err=%v", parcelCount, err)
	}
	now := time.Now().UTC()
	if err := resource.CompleteShipmentBooking(ctx, store.ShipmentRecord{Id: shipmentId, StoreId: storeId, ProviderReference: "carrier-1", Status: logistics.StatusBooked, BookedAt: &now}, quoteId); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `SELECT status FROM delivery_quotes WHERE id = $1`, quoteId).Scan(&status); err != nil || status != "booked" {
		t.Fatalf("quote status=%q err=%v", status, err)
	}
}

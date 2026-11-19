package logistics_test

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"

	"nantty/modules/orders/src/modules/partnerLogistics/store"
)

func TestShipmentReferenceIsScopedToStoreAndProvider(t *testing.T) {
	url := os.Getenv("ORDERS_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("ORDERS_TEST_DATABASE_URL is not configured")
	}
	db, err := sql.Open("pgx", url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	ctx := context.Background()
	if _, err := db.ExecContext(ctx, `CREATE TEMP TABLE shipments (store_id uuid NOT NULL, provider text NOT NULL, provider_reference text NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	owner, other := uuid.New(), uuid.New()
	if _, err := db.ExecContext(ctx, `INSERT INTO shipments VALUES ($1, $2, $3)`, owner, "kwikpik", "shipment-1"); err != nil {
		t.Fatal(err)
	}
	shipmentStore := store.PartnerLogisticsStore{Database: db}
	for _, tc := range []struct {
		name, provider, reference string
		storeId                   uuid.UUID
		want                      bool
	}{
		{"owner", "kwikpik", "shipment-1", owner, true},
		{"other store", "kwikpik", "shipment-1", other, false},
		{"other provider", "other", "shipment-1", owner, false},
		{"unknown shipment", "kwikpik", "missing", owner, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := shipmentStore.HasProviderShipment(ctx, tc.storeId, tc.provider, tc.reference)
			if err != nil || got != tc.want {
				t.Fatalf("HasProviderShipment = %v, %v; want %v", got, err, tc.want)
			}
		})
	}
}

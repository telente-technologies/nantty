package orders_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
)

func TestBuyerShoppedStoresListOnlyCompletedOrdersBehindTheInternalToken(t *testing.T) {
	harness := startAdminHarness(t, "held")
	harness.module.Container.Settings.InternalApiToken = strings.Repeat("i", 32)
	ctx := context.Background()
	buyer, shopped, pending := uuid.New(), uuid.New(), uuid.New()
	for index, row := range []struct {
		store  uuid.UUID
		status string
	}{{shopped, "completed"}, {shopped, "completed"}, {pending, "shipped"}} {
		reference := "ZM-SHOP-000" + string(rune('1'+index))
		if err := harness.module.Container.Client.OrderGroup.Create().SetCheckoutID(uuid.New()).SetReference(reference).SetInvoiceNumber("INV-" + reference).SetStoreID(row.store).
			SetSellerAccountID(uuid.New()).SetBuyerAccountID(buyer).SetCurrency("NGN").SetSubtotalMinor(1_000).SetShippingMinor(0).SetTotalMinor(1_000).SetStatus(row.status).
			SetPaymentStatus("paid").SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG"}).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	path := "/internal/v1/buyers/" + buyer.String() + "/stores"
	if status, _, _ := harness.call("GET", path, nil, map[string]string{"X-Internal-Token": "wrong"}); status != http.StatusUnauthorized {
		t.Fatalf("wrong token: %d", status)
	}
	status, page, _ := harness.call("GET", path, nil, map[string]string{"X-Internal-Token": strings.Repeat("i", 32)})
	data, _ := page["data"].([]any)
	if status != http.StatusOK || len(data) != 1 || data[0].(map[string]any)["storeId"] != shopped.String() || data[0].(map[string]any)["completedOrders"].(float64) != 2 {
		t.Fatalf("shopped stores: %d %v", status, page)
	}
}

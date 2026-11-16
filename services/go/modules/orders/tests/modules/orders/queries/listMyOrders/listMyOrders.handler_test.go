package listmyorders_test

import (
	"slices"
	"testing"

	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/modules/orders/queries/listMyOrders"
)

func TestToShipBuyerFilterIncludesSellerPreparationAndAwaitingPayment(t *testing.T) {
	want := []string{enums.StatusPending, enums.StatusNew, enums.StatusProcessing, enums.StatusReady}
	got, found := listmyorders.StatusesForBuyerFilter("to_ship")
	if !found || !slices.Equal(got, want) {
		t.Fatalf("to_ship filter = %v, want %v", got, want)
	}
	got[0] = "tampered"
	if fresh, found := listmyorders.StatusesForBuyerFilter("to_ship"); !found || !slices.Equal(fresh, want) {
		t.Fatalf("filter exposed mutable internal state: %v", fresh)
	}
	if _, found := listmyorders.StatusesForBuyerFilter("unknown"); found {
		t.Fatal("unknown filter must not resolve to statuses")
	}
}

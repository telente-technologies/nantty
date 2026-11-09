package listmyorders

import (
	"slices"
	"testing"

	"nantty/modules/orders/src/enums"
)

func TestToShipBuyerFilterIncludesSellerPreparationAndAwaitingPayment(t *testing.T) {
	want := []string{enums.StatusPending, enums.StatusNew, enums.StatusProcessing, enums.StatusReady}
	if got := statusesByBuyerFilter["to_ship"]; !slices.Equal(got, want) {
		t.Fatalf("to_ship filter = %v, want %v", got, want)
	}
}

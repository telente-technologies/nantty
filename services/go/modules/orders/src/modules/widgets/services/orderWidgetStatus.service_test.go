package services

import (
	"testing"

	"zudomart/modules/orders/src/enums"
)

func TestOrderWidgetStatusForCoversTheDeliveryJourney(t *testing.T) {
	cases := []struct {
		status, delivery string
		rider            bool
		want             string
	}{
		{enums.StatusNew, "pending", false, "confirmed"},
		{enums.StatusProcessing, "preparing", false, "preparing"},
		{enums.StatusReady, "ready_for_pickup", false, "ready_to_ship"},
		{enums.StatusShipped, "in_transit", false, "in_transit"},
		{enums.StatusShipped, "in_transit", true, "out_for_delivery"},
		{enums.StatusShipped, "failed", true, "delivery_failed"},
		{enums.StatusDelivered, "delivered", false, "delivered"},
		{enums.StatusCancelled, "cancelled", false, "other"},
	}
	for _, testCase := range cases {
		if got := OrderWidgetStatusFor(testCase.status, testCase.delivery, testCase.rider); got.Key != testCase.want || got.Label == "" {
			t.Fatalf("%s/%s rider=%v = %+v, want %s", testCase.status, testCase.delivery, testCase.rider, got, testCase.want)
		}
	}
	if OrderDeepLink("abc") != "zudomart://orders/abc" {
		t.Fatal("unexpected deep link")
	}
}

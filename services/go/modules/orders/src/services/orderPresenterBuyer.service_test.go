package services

import (
	"testing"
	"time"
)

func TestBuyerDeliveryViewHidesUntouchedPendingDeliveries(t *testing.T) {
	if view := buyerDeliveryView("pending", nil, nil, nil, 0, nil); view != nil {
		t.Fatalf("an untouched pending delivery must not clutter the buyer order: %+v", view)
	}
}

func TestBuyerDeliveryViewShowsSellerDeliveryUpdates(t *testing.T) {
	riderName, riderPhone := "Tunde", "+2348030000000"
	note := "Buyer not reachable on phone"
	eta := time.Now().Add(2 * time.Hour)
	view := buyerDeliveryView("failed", &riderName, &riderPhone, &eta, 2, &note)
	if view == nil {
		t.Fatal("a failed delivery attempt must be visible to the buyer")
	}
	if view.Status != "failed" || view.Attempts != 2 {
		t.Fatalf("seller delivery updates were not copied to the buyer view: %+v", view)
	}
	if view.RiderName == nil || *view.RiderName != riderName || view.RiderPhone == nil || *view.RiderPhone != riderPhone {
		t.Fatalf("rider details are missing from the buyer view: %+v", view)
	}
	if view.EstimatedDeliveryAt == nil || !view.EstimatedDeliveryAt.Equal(eta) || view.LastAttemptNote == nil || *view.LastAttemptNote != note {
		t.Fatalf("delivery estimate or attempt note is missing from the buyer view: %+v", view)
	}
}

func TestBuyerDeliveryViewShowsStatusChangesWithoutRiderDetails(t *testing.T) {
	view := buyerDeliveryView("ready_for_pickup", nil, nil, nil, 0, nil)
	if view == nil || view.Status != "ready_for_pickup" {
		t.Fatalf("a delivery status update must reach the buyer even before a rider is assigned: %+v", view)
	}
}

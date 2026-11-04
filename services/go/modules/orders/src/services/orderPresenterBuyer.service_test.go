package services

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/orders/src/generated/ent"
	"nantty/platform/commerceports"
	"nantty/platform/usersdirectory"
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

func TestBuyerOrderViewDoesNotExposeCarrierTrackingURL(t *testing.T) {
	now := time.Now().UTC()
	courier, trackingNumber, trackingURL := "Sample Courier", "TEST-TRACK-1234", "https://carrier.example/track/secret"
	group := &ent.OrderGroup{
		ID: uuid.New(), CheckoutID: uuid.New(), BuyerAccountID: uuid.New(), StoreID: uuid.New(),
		Reference: "ZM-TEST-0001", Currency: "NGN", Status: "shipped", PaymentStatus: "paid", PaymentMode: "escrow",
		CourierName: &courier, TrackingNumber: &trackingNumber, TrackingURL: &trackingURL, ShippedAt: &now,
	}
	view := buyerOrderView(group, nil, commerceports.StoreSnapshot{}, usersdirectory.ProfileName{}, nil)
	if view.Shipment == nil || view.Shipment.TrackingNumber != trackingNumber {
		t.Fatalf("buyer shipment must retain its number but not the carrier URL: %+v", view.Shipment)
	}
	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), trackingURL) || strings.Contains(string(encoded), "trackingUrl") {
		t.Fatalf("buyer order response leaked carrier URL: %s", encoded)
	}
}

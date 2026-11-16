package services_test

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/usersdirectory"
)

func TestBuyerDeliveryViewHidesUntouchedPendingDeliveries(t *testing.T) {
	if view := services.BuyerDeliveryView("pending", nil, nil, nil, 0, nil); view != nil {
		t.Fatalf("an untouched pending delivery must not clutter the buyer order: %+v", view)
	}
}

func TestBuyerDeliveryViewShowsSellerDeliveryUpdates(t *testing.T) {
	riderName, riderPhone := "Tunde", "+2348030000000"
	note := "Buyer not reachable on phone"
	eta := time.Now().Add(2 * time.Hour)
	view := services.BuyerDeliveryView("failed", &riderName, &riderPhone, &eta, 2, &note)
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
	view := services.BuyerDeliveryView("ready_for_pickup", nil, nil, nil, 0, nil)
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
	view := services.BuildBuyerOrderView(group, nil, commerceports.StoreSnapshot{}, usersdirectory.ProfileName{}, nil, nil)
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

func TestBuyerOrderViewExposesSafeOrderTimelineOnly(t *testing.T) {
	created := time.Date(2026, 11, 13, 10, 30, 0, 0, time.UTC)
	group := &ent.OrderGroup{ID: uuid.New(), CheckoutID: uuid.New(), BuyerAccountID: uuid.New(), StoreID: uuid.New(), Currency: "NGN"}
	events := []*ent.OrderEvent{
		{ID: uuid.New(), Kind: "shipped", Summary: "raw seller summary with private landmark", CreatedAt: created},
		{ID: uuid.New(), Kind: "note", Summary: "Internal note: buyer's personal detail", CreatedAt: created.Add(time.Minute)},
	}
	view := services.BuildBuyerOrderView(group, nil, commerceports.StoreSnapshot{}, usersdirectory.ProfileName{}, nil, events)
	if len(view.Timeline) != 1 {
		t.Fatalf("only buyer-safe status events should be returned: %+v", view.Timeline)
	}
	if view.Timeline[0].Summary != "Order marked as shipped" || !view.Timeline[0].CreatedAt.Equal(created) {
		t.Fatalf("buyer timeline should use safe copy and preserve event time: %+v", view.Timeline[0])
	}
	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "private landmark") || strings.Contains(string(encoded), "Internal note") {
		t.Fatalf("buyer timeline leaked seller/internal event text: %s", encoded)
	}
}

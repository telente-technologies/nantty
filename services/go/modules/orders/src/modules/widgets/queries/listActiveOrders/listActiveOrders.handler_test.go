package listactiveorders

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/generated/ent"
)

func TestOrderWidgetItemIncludesTrackingURLOnlyWhenAvailable(t *testing.T) {
	trackingURL := "https://carrier.example/track/NT123"
	group := &ent.OrderGroup{
		ID:        uuid.MustParse("0192f0a0-0000-7000-8000-000000000001"),
		Reference: "NT123", Status: "shipped", DeliveryStatus: "in_transit",
		TrackingURL: &trackingURL, UpdatedAt: time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC),
	}
	item := orderWidgetItem(group, nil, "Ayo Market")
	encoded, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["trackingUrl"] != trackingURL {
		t.Fatalf("trackingUrl = %v, want %s", payload["trackingUrl"], trackingURL)
	}

	group.TrackingURL = nil
	item = orderWidgetItem(group, nil, "Ayo Market")
	encoded, err = json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	if json.Valid(encoded) && containsJSONKey(encoded, "trackingUrl") {
		t.Fatalf("trackingUrl should be omitted when absent: %s", encoded)
	}
}

func containsJSONKey(encoded []byte, key string) bool {
	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		return false
	}
	_, exists := payload[key]
	return exists
}

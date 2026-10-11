package catalog

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/jobs"
)

func visibilityEnvelope(targetType, targetId, visibility string, occurredAt time.Time) []byte {
	data, _ := json.Marshal(map[string]any{"targetType": targetType, "targetId": targetId, "visibility": visibility})
	envelope, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "type": "content.visibilityChanged", "source": "trust", "subject": targetId, "schemaVersion": 1, "occurredAt": occurredAt.UTC().Format(time.RFC3339), "data": json.RawMessage(data)})
	return envelope
}

func TestAStaleVisibleEventNeverRepublishesRemovedContent(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("visibility-owner")
	store := harness.store(ownerId, "Ordering Store")
	product := harness.product(store, "Ordering Product", 1000, true)
	apply := jobs.ApplyContentVisibilityChangedMessage(harness.module.Container)
	older, newer := time.Now().Add(-time.Hour), time.Now()
	for _, message := range [][]byte{
		visibilityEnvelope("product", product.ID.String(), "removed", newer),
		visibilityEnvelope("product", product.ID.String(), "visible", older),
		visibilityEnvelope("store", store.ID.String(), "hidden", newer),
		visibilityEnvelope("store", store.ID.String(), "visible", older),
	} {
		if err := apply(context.Background(), message); err != nil {
			t.Fatal(err)
		}
	}
	ctx := context.Background()
	if got := harness.client().Product.GetX(ctx, product.ID).ModerationVisibility; got != "removed" {
		t.Fatalf("product visibility = %s, want removed", got)
	}
	if got := harness.client().Store.GetX(ctx, store.ID).ModerationVisibility; got != "hidden" {
		t.Fatalf("store visibility = %s, want hidden", got)
	}
	if err := apply(ctx, visibilityEnvelope("product", product.ID.String(), "visible", newer.Add(time.Minute))); err != nil {
		t.Fatal(err)
	}
	if got := harness.client().Product.GetX(ctx, product.ID).ModerationVisibility; got != "visible" {
		t.Fatalf("a newer reinstatement applies, got %s", got)
	}
}

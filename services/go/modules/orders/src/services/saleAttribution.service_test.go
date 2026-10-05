package services

import (
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/generated/ent"
)

func TestOnlyAttributedOrderItemsAreOfferedForCommission(t *testing.T) {
	source, postId := "post", uuid.New()
	group := &ent.OrderGroup{ID: uuid.New(), Currency: "NGN"}
	items := []*ent.OrderItem{
		{ID: uuid.New(), Quantity: 2, LineTotalMinor: 10_000, AttributionSource: &source, AttributionID: &postId},
		{ID: uuid.New(), Quantity: 1, LineTotalMinor: 2_000},
	}
	attributed := AttributedSaleItemsOf(group, items)
	if len(attributed) != 1 || attributed[0].AttributionId != postId || attributed[0].LineTotalMinor != 10_000 || attributed[0].Currency != "NGN" {
		t.Fatalf("attributed: %+v", attributed)
	}
}

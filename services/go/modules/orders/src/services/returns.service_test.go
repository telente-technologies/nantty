package services

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/generated/ent"
)

func TestReturnRefundCoversOnlyChosenLinesAndScalesForDiscounts(t *testing.T) {
	shirt, hat := uuid.New(), uuid.New()
	items := map[uuid.UUID]*ent.OrderItem{shirt: {ID: shirt, UnitPriceMinor: 10_000, Quantity: 3}, hat: {ID: hat, UnitPriceMinor: 5_000, Quantity: 1}}
	refund, valid := ReturnRefundMinor(items, []schema.ReturnLine{{OrderItemId: shirt.String(), Quantity: 2}}, 1, 1)
	if !valid || refund != 20_000 {
		t.Fatalf("refund = %d valid=%v, want 20000", refund, valid)
	}
	refund, valid = ReturnRefundMinor(items, []schema.ReturnLine{{OrderItemId: shirt.String(), Quantity: 2}}, 90, 100)
	if !valid || refund != 18_000 {
		t.Fatalf("a 10%% order discount must reduce the refund, got %d", refund)
	}
}

func TestReturnRejectsUnknownDuplicateAndOversizedLines(t *testing.T) {
	shirt := uuid.New()
	items := map[uuid.UUID]*ent.OrderItem{shirt: {ID: shirt, UnitPriceMinor: 10_000, Quantity: 1}}
	cases := map[string][]schema.ReturnLine{
		"too many":  {{OrderItemId: shirt.String(), Quantity: 2}},
		"unknown":   {{OrderItemId: uuid.NewString(), Quantity: 1}},
		"duplicate": {{OrderItemId: shirt.String(), Quantity: 1}, {OrderItemId: shirt.String(), Quantity: 1}},
		"zero":      {{OrderItemId: shirt.String(), Quantity: 0}},
		"empty":     {},
	}
	for name, lines := range cases {
		if _, valid := ReturnRefundMinor(items, lines, 1, 1); valid {
			t.Errorf("%s must be rejected", name)
		}
	}
}

package services_test

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/services"
	"nantty/platform/commerceports"
)

func TestMergeStockLinesCombinesDuplicateVariantsInStableOrder(t *testing.T) {
	first, second := uuid.MustParse("00000000-0000-0000-0000-000000000002"), uuid.MustParse("00000000-0000-0000-0000-000000000001")
	merged, err := services.MergeStockLines([]commerceports.StockLine{{VariantId: first, Quantity: 2}, {VariantId: second, Quantity: 1}, {VariantId: first, Quantity: 3}})
	if err != nil || len(merged) != 2 {
		t.Fatalf("merge failed: %v %+v", err, merged)
	}
	if merged[0].VariantId != second || merged[1].Quantity != 5 {
		t.Fatalf("unexpected merge result %+v", merged)
	}
	if _, err := services.MergeStockLines([]commerceports.StockLine{{VariantId: first, Quantity: 0}}); err == nil {
		t.Fatal("expected zero quantity to be rejected")
	}
}

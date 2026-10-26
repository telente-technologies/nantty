package validators

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
)

func flashSale(length time.Duration, items []dtos.FlashSaleItemInput) dtos.FlashSaleRequest {
	name, starts := "Weekend flash", time.Date(2026, 10, 10, 9, 0, 0, 0, time.UTC)
	ends := starts.Add(length)
	return dtos.FlashSaleRequest{Name: &name, StartsAt: &starts, EndsAt: &ends, Items: items}
}

func TestFlashSaleRulesFollowTheSellerContract(t *testing.T) {
	product, cap := uuid.NewString(), 50
	valid := []dtos.FlashSaleItemInput{{ProductId: product, SalePriceMinor: 9_000, StockCap: &cap}}
	if err := ValidateFlashSale(flashSale(48*time.Hour, valid)); err != nil {
		t.Fatalf("expected valid flash sale, got %v", err)
	}
	tooBig := 100_001
	invalid := map[string]dtos.FlashSaleRequest{
		"longer than a week": flashSale(8*24*time.Hour, valid),
		"no items":           flashSale(time.Hour, nil),
		"duplicate product":  flashSale(time.Hour, []dtos.FlashSaleItemInput{valid[0], valid[0]}),
		"stock cap too big":  flashSale(time.Hour, []dtos.FlashSaleItemInput{{ProductId: product, SalePriceMinor: 1, StockCap: &tooBig}}),
		"free":               flashSale(time.Hour, []dtos.FlashSaleItemInput{{ProductId: product, SalePriceMinor: 0}}),
	}
	for name, request := range invalid {
		if ValidateFlashSale(request) == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
	pause, name := "pause", "x"
	if ValidateFlashSale(dtos.FlashSaleRequest{Action: &pause}) != nil || ValidateFlashSale(dtos.FlashSaleRequest{Action: &pause, Name: &name}) == nil {
		t.Fatal("actions must stand alone")
	}
}

func TestBundleNeedsTwoUnitsAndAKnownStatus(t *testing.T) {
	single := dtos.ProductBundleRequest{Name: "Starter kit", BundlePriceMinor: 1_000, Status: "active", Items: []dtos.BundleItemInput{{ProductId: uuid.NewString(), Quantity: 1}}}
	if ValidateProductBundle(single) == nil {
		t.Fatal("a single unit is not a bundle")
	}
	pair := single
	pair.Items = []dtos.BundleItemInput{{ProductId: uuid.NewString(), Quantity: 2}}
	if err := ValidateProductBundle(pair); err != nil {
		t.Fatalf("two units of one product should pass, got %v", err)
	}
	pair.Status = "live"
	if ValidateProductBundle(pair) == nil {
		t.Fatal("unknown status should fail")
	}
}

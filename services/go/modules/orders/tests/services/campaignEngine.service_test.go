package services_test

import (
	"testing"

	"github.com/google/uuid"
	"nantty/modules/orders/src/services"
)

func TestFlashSaleDiscountStopsAtTheRemainingStockCap(t *testing.T) {
	shoe, cap := uuid.New(), 2
	plan := services.PlanCampaignDiscounts([]services.CampaignLine{{ProductId: shoe, Quantity: 3, UnitPriceMinor: 10_000}}, []services.FlashSaleOffer{{FlashSaleId: uuid.New(), ProductId: shoe, SalePriceMinor: 7_000, RemainingUnits: &cap}}, nil)
	if plan.DiscountMinor != 6_000 || plan.Applications[0].Units != 2 || plan.Applications[0].RevenueMinor != 14_000 {
		t.Fatalf("unexpected plan %+v", plan)
	}
}

func TestBundleAppliesOnlyToUnitsNotAlreadyOnFlashSale(t *testing.T) {
	shirt, trouser := uuid.New(), uuid.New()
	lines := []services.CampaignLine{{ProductId: shirt, Quantity: 2, UnitPriceMinor: 5_000}, {ProductId: trouser, Quantity: 2, UnitPriceMinor: 8_000}}
	flashCap := 1
	flash := []services.FlashSaleOffer{{FlashSaleId: uuid.New(), ProductId: shirt, SalePriceMinor: 4_000, RemainingUnits: &flashCap}}
	bundle := []services.BundleOffer{{BundleId: uuid.New(), BundlePriceMinor: 11_000, Items: []services.BundleOfferItem{{ProductId: shirt, Quantity: 1}, {ProductId: trouser, Quantity: 1}}}}
	plan := services.PlanCampaignDiscounts(lines, flash, bundle)
	if plan.DiscountMinor != 1_000+2_000 || len(plan.Applications) != 2 || plan.Applications[1].Units != 1 {
		t.Fatalf("unexpected plan %+v", plan)
	}
}

func TestBundleThatSavesNothingIsIgnored(t *testing.T) {
	cap := uuid.New()
	plan := services.PlanCampaignDiscounts([]services.CampaignLine{{ProductId: cap, Quantity: 2, UnitPriceMinor: 1_000}}, nil, []services.BundleOffer{{BundleId: uuid.New(), BundlePriceMinor: 2_500, Items: []services.BundleOfferItem{{ProductId: cap, Quantity: 2}}}})
	if plan.DiscountMinor != 0 || len(plan.Applications) != 0 {
		t.Fatalf("unexpected plan %+v", plan)
	}
}

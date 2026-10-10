package regionpricing

import (
	"encoding/json"
	"os"
	"testing"
)

type storeProductsDocument struct {
	SlotsPerTierAndInterval int `json:"slotsPerTierAndInterval"`
	Products                []struct {
		ProductId string `json:"productId"`
		Tier      string `json:"tier"`
		Interval  string `json:"interval"`
		Slot      int    `json:"slot"`
		Prices    map[string]struct {
			Currency                string `json:"currency"`
			WebMinor                int64  `json:"webMinor"`
			AppleMinor              int64  `json:"appleMinor"`
			AppleSmallBusinessMinor int64  `json:"appleSmallBusinessMinor"`
			GoogleMinor             int64  `json:"googleMinor"`
		} `json:"prices"`
	} `json:"products"`
}

func TestStoreProductCatalogueMatchesTheTierLadder(t *testing.T) {
	raw, err := os.ReadFile("../../../../infra/appStore/creatorSubscriptionProducts.json")
	if err != nil {
		t.Skipf("product catalogue not present: %v", err)
	}
	var document storeProductsDocument
	if err := json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}
	if document.SlotsPerTierAndInterval != CreatorStoreSlots || len(document.Products) != len(CreatorTierKeys)*2*CreatorStoreSlots {
		t.Fatalf("catalogue has %d products for %d slots; regenerate infra/appStore/creatorSubscriptionProducts.json", len(document.Products), document.SlotsPerTierAndInterval)
	}
	fees := DefaultStoreFeeSettings()
	smallBusiness := fees
	smallBusiness.AppleSmallBusinessProgram = true
	for _, product := range document.Products {
		if CreatorStoreProductId(product.Tier, product.Interval, product.Slot) != product.ProductId {
			t.Fatalf("%s does not match tier %s %s slot %d", product.ProductId, product.Tier, product.Interval, product.Slot)
		}
		for _, region := range SupportedRegions() {
			price, found := product.Prices[region.Code]
			web, _ := CreatorTierWebPrice(product.Tier, region.Currency, product.Interval)
			if !found || price.Currency != region.Currency || price.WebMinor != web ||
				price.AppleMinor != GrossUpForStoreFee(web, fees.FeeBpsForChannel("ios"), region.Currency) ||
				price.AppleSmallBusinessMinor != GrossUpForStoreFee(web, smallBusiness.FeeBpsForChannel("ios"), region.Currency) ||
				price.GoogleMinor != GrossUpForStoreFee(web, fees.FeeBpsForChannel("android"), region.Currency) {
				t.Fatalf("%s %s prices %+v drift from the code", product.ProductId, region.Code, price)
			}
		}
	}
}

package services_test

import (
	"strings"
	"testing"

	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/services"
)

func variantWith(prices ...schema.RegionalPrice) *ent.ProductVariant {
	return &ent.ProductVariant{RegionalPrices: prices}
}

func TestRegionalPriceAppliesOnlyWhenEveryVariantHasOne(t *testing.T) {
	ghs := schema.RegionalPrice{Currency: "GHS", PriceMinor: 900}
	if !services.AllHaveRegionalPrice([]*ent.ProductVariant{variantWith(ghs), variantWith(ghs)}, "GHS") {
		t.Fatal("all variants priced in GHS must use the regional price")
	}
	if services.AllHaveRegionalPrice([]*ent.ProductVariant{variantWith(ghs), variantWith()}, "GHS") {
		t.Fatal("one variant without a GHS price keeps the whole seller order in the default currency")
	}
	if services.AllHaveRegionalPrice(nil, "GHS") {
		t.Fatal("nothing to price")
	}
}

func TestDisplayPricingPrefersRegionalThenApproximatesThenStaysPut(t *testing.T) {
	row := &ent.Product{Currency: "NGN", MinPriceMinor: 155_000}
	rates := map[string]int64{"USD": 100_000_000, "NGN": 155_000_000_000, "GHS": 1_550_000_000}
	pricing := services.DisplayPricing{Currency: "GHS", Rates: rates}

	regional := pricing.ForProduct(row, []*ent.ProductVariant{variantWith(schema.RegionalPrice{Currency: "GHS", PriceMinor: 2_000})})
	if !regional.IsRegional || regional.Price.AmountMinor != 2_000 || regional.Price.Currency != "GHS" || regional.Approx != nil {
		t.Fatalf("regional price expected: %+v", regional)
	}
	converted := pricing.ForProduct(row, []*ent.ProductVariant{variantWith()})
	if converted.IsRegional || converted.Price.Currency != "NGN" || converted.Approx == nil || converted.Approx.AmountMinor != 1_550 {
		t.Fatalf("approximate conversion expected: %+v", converted)
	}
	noRates := services.DisplayPricing{Currency: "GHS"}.ForProduct(row, []*ent.ProductVariant{variantWith()})
	if noRates.Approx != nil || noRates.Price.AmountMinor != 155_000 {
		t.Fatalf("no rate means the default price with no approximation: %+v", noRates)
	}
	home := services.DisplayPricing{Currency: "NGN", Rates: rates}.ForProduct(row, []*ent.ProductVariant{variantWith()})
	if home.Approx != nil || home.IsRegional {
		t.Fatalf("a buyer in the seller's market sees the plain price: %+v", home)
	}
}

func TestStoreShipsToDefaultsToTheStoreCountry(t *testing.T) {
	domestic := &ent.Store{CountryCode: "NG"}
	if !services.StoreShipsTo(domestic, "NG") || services.StoreShipsTo(domestic, "GH") || !services.StoreShipsTo(domestic, "") {
		t.Fatal("a store with no configured destinations ships to its own country, and an unknown viewer region hides nothing")
	}
	abroad := &ent.Store{CountryCode: "NG", ShippingCountryCodes: []string{"GH", "KE"}}
	if services.StoreShipsTo(abroad, "NG") || !services.StoreShipsTo(abroad, "GH") {
		t.Fatal("configured destinations replace the default")
	}
	if got := services.NormalizeShippingCountries([]string{"gh", "GH", "nga", "ke"}); strings.Join(got, ",") != "GH,KE" {
		t.Fatalf("unexpected %v", got)
	}
}

func TestRegionConditionFiltersOnShippingCountriesAndKeepsSellersProducts(t *testing.T) {
	viewer := uuid.New()
	selector := sql.Dialect(dialect.Postgres).Select("*").From(sql.Table("products"))
	services.ShipsToCountryCondition("GH", &viewer)(selector)
	query, args := selector.Query()
	if !strings.Contains(query, "shipping_country_codes @> to_jsonb(") || !strings.Contains(query, "owner_account_id") || len(args) != 4 {
		t.Fatalf("unexpected query %s %v", query, args)
	}
	if services.ShipsToCountryCondition("", nil) != nil {
		t.Fatal("an unknown region adds no filter")
	}
}

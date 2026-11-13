package services

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"nantty/platform/commerceports"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

func TestShippingQuoteRevisionIsOrderIndependentAndTracksPriceInputs(t *testing.T) {
	address := usersdirectory.ShippingAddress{Id: uuid.New(), CountryCode: "NG", UpdatedAt: time.Date(2026, 11, 13, 10, 0, 0, 0, time.UTC)}
	storeId, itemId, variantId := uuid.New(), uuid.New(), uuid.New()
	group := SellerGroup{
		StoreId: storeId, SubtotalMinor: 5000, Currency: money.CurrencyCode("NGN"),
		Lines: []PricedCartLine{{ItemId: itemId, Quantity: 2, Product: commerceports.ProductSnapshot{VariantId: variantId, UnitPrice: money.Money{AmountMinor: 2500, Currency: money.CurrencyCode("NGN")}}}},
	}
	shipping := ShippingResult{Outcome: "calculated", FeeMinor: 500}
	first := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil)})
	if first == "" {
		t.Fatal("expected a non-empty quote revision")
	}
	other := SellerGroup{StoreId: uuid.New(), SubtotalMinor: 1000, Currency: money.CurrencyCode("NGN"), Lines: []PricedCartLine{{ItemId: uuid.New(), Quantity: 1, Product: commerceports.ProductSnapshot{VariantId: uuid.New()}}}}
	second := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(other, shipping, nil), revisionGroupFor(group, shipping, nil)})
	third := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil), revisionGroupFor(other, shipping, nil)})
	if second != third {
		t.Fatalf("quote revision must not depend on seller-group order: %q vs %q", second, third)
	}
	group.SubtotalMinor++
	changedSubtotal := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil), revisionGroupFor(other, shipping, nil)})
	if second == changedSubtotal {
		t.Fatal("cart price changes must produce a different quote revision")
	}
	group.Lines[0].Product.UnitPrice.AmountMinor++
	changedLinePrice := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil), revisionGroupFor(other, shipping, nil)})
	if changedSubtotal == changedLinePrice {
		t.Fatal("individual line price changes must produce a different quote revision even when group totals match")
	}
	shipping.FeeMinor++
	changedShipping := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil), revisionGroupFor(other, shipping, nil)})
	if second == changedShipping {
		t.Fatal("shipping fee changes must produce a different quote revision")
	}
	address.RegionId = uuidPtr(uuid.New())
	changedDestination := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil), revisionGroupFor(other, shipping, nil)})
	if changedShipping == changedDestination {
		t.Fatal("delivery location changes must produce a different quote revision")
	}
	address.UpdatedAt = address.UpdatedAt.Add(time.Second)
	changedAddress := shippingQuoteRevisionFor(address, []shippingQuoteRevisionGroup{revisionGroupFor(group, shipping, nil), revisionGroupFor(other, shipping, nil)})
	if changedDestination == changedAddress {
		t.Fatal("editing a saved delivery address must produce a different quote revision")
	}
}

func uuidPtr(value uuid.UUID) *uuid.UUID { return &value }

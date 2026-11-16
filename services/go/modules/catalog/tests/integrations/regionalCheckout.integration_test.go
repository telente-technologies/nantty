package integrations_test

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/integrations"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func checkoutFixture(storeCountry string, shipsTo []string, regional ...schema.RegionalPrice) (*ent.Store, map[uuid.UUID][]*ent.ProductVariant, map[uuid.UUID]commerceports.ProductSnapshot, *ent.ProductVariant) {
	owner := &ent.Store{ID: uuid.New(), CountryCode: storeCountry, ShippingCountryCodes: shipsTo}
	variant := &ent.ProductVariant{ID: uuid.New(), StoreID: owner.ID, RegionalPrices: regional}
	snapshots := map[uuid.UUID]commerceports.ProductSnapshot{variant.ID: {VariantId: variant.ID, Purchasable: true, UnitPrice: money.Money{AmountMinor: 500_000, Currency: "NGN"}}}
	return owner, map[uuid.UUID][]*ent.ProductVariant{owner.ID: {variant}}, snapshots, variant
}

func TestCheckoutChargesTheRegionalPriceInItsOwnCurrency(t *testing.T) {
	owner, byStore, snapshots, variant := checkoutFixture("NG", []string{"NG", "GH"}, schema.RegionalPrice{Currency: "GHS", PriceMinor: 4_500})
	integrations.ApplyRegionalCheckoutRules([]*ent.Store{owner}, byStore, snapshots, "GH")
	if got := snapshots[variant.ID]; got.UnitPrice.AmountMinor != 4_500 || got.UnitPrice.Currency != "GHS" || !got.Purchasable {
		t.Fatalf("a Ghana buyer is charged the GHS price: %+v", got)
	}
}

func TestCheckoutKeepsTheDefaultPriceWhenNoRegionalPriceExists(t *testing.T) {
	owner, byStore, snapshots, variant := checkoutFixture("NG", []string{"NG", "GH"})
	integrations.ApplyRegionalCheckoutRules([]*ent.Store{owner}, byStore, snapshots, "GH")
	if got := snapshots[variant.ID]; got.UnitPrice.AmountMinor != 500_000 || got.UnitPrice.Currency != "NGN" {
		t.Fatalf("the default price and currency stay: %+v", got)
	}
}

func TestCheckoutRefusesProductsFromSellersThatDoNotShipToTheBuyer(t *testing.T) {
	owner, byStore, snapshots, variant := checkoutFixture("NG", nil, schema.RegionalPrice{Currency: "GHS", PriceMinor: 4_500})
	integrations.ApplyRegionalCheckoutRules([]*ent.Store{owner}, byStore, snapshots, "GH")
	got := snapshots[variant.ID]
	if got.Purchasable || got.UnitPrice.Currency != "NGN" {
		t.Fatalf("a domestic-only seller is not purchasable from Ghana and gets no regional price: %+v", got)
	}
	integrations.ApplyRegionalCheckoutRules([]*ent.Store{owner}, byStore, map[uuid.UUID]commerceports.ProductSnapshot{variant.ID: {Purchasable: true}}, "NG")
}

func TestCheckoutWithoutARegionChangesNothing(t *testing.T) {
	owner, byStore, snapshots, variant := checkoutFixture("NG", nil)
	integrations.ApplyRegionalCheckoutRules([]*ent.Store{owner}, byStore, snapshots, "")
	if !snapshots[variant.ID].Purchasable {
		t.Fatal("an unknown region must not block a purchase")
	}
}

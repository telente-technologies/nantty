package catalog

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/productvariant"
)

func TestProductListingFiltersSupportedCollections(t *testing.T) {
	harness := startHttpHarness(t)
	fixedNow := time.Date(2026, time.November, 5, 12, 0, 0, 0, time.UTC)
	harness.module.Container.Now = func() time.Time { return fixedNow }
	ownerId, _ := harness.account("collectionowner")
	verifiedStore := harness.store(ownerId, "Verified Collection Shop")
	if err := verifiedStore.Update().SetVerified(true).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	unverifiedStore := harness.store(ownerId, "Unverified Collection Shop")

	sale := harness.product(verifiedStore, "Sale Product", 1_000, true)
	regular := harness.product(verifiedStore, "Regular Product", 1_000, true)
	saleVariant, err := harness.client().ProductVariant.Query().Where(productvariant.ProductID(sale.ID)).Only(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := saleVariant.Update().SetCompareAtPriceMinor(1_500).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}

	featured := harness.product(verifiedStore, "Featured Product", 1_000, true)
	if err := featured.Update().SetRatingSum(23).SetRatingCount(5).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	belowRating := harness.product(verifiedStore, "Below Featured Rating", 1_000, true)
	if err := belowRating.Update().SetRatingSum(22).SetRatingCount(5).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	unverified := harness.product(unverifiedStore, "Unverified Product", 1_000, true)
	if err := unverified.Update().SetRatingSum(25).SetRatingCount(5).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}

	newArrival := harness.product(verifiedStore, "Recent Product", 1_000, true)
	oldArrival := harness.product(verifiedStore, "Older Product", 1_000, true)
	oldPublishedAt := fixedNow.Add(-8 * 24 * time.Hour)
	for _, row := range []*ent.Product{sale, regular, featured, belowRating, unverified, oldArrival} {
		if err := row.Update().SetPublishedAt(oldPublishedAt).Exec(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	if err := newArrival.Update().SetPublishedAt(fixedNow.Add(-7 * 24 * time.Hour)).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}

	listedIds := func(collection string) map[string]bool {
		t.Helper()
		body := harness.expect("GET", "/api/v1/products?collection="+collection, "", nil, 200)
		found := map[string]bool{}
		for _, raw := range items(body, "data") {
			found[raw.(map[string]any)["id"].(string)] = true
		}
		return found
	}
	assertSet := func(collection string, want ...uuid.UUID) {
		t.Helper()
		got := listedIds(collection)
		if len(got) != len(want) {
			t.Fatalf("%s returned %d products, want %d: %v", collection, len(got), len(want), got)
		}
		for _, id := range want {
			if !got[id.String()] {
				t.Errorf("%s did not include expected product %s", collection, id)
			}
		}
	}

	assertSet("sales_of_the_day", sale.ID)
	assertSet("featured_brands", featured.ID)
	assertSet("new_arrivals", newArrival.ID)
	harness.expect("GET", "/api/v1/products?collection=unsupported", "", nil, 400)
}

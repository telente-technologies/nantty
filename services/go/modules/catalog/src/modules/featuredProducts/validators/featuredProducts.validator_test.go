package validators

import (
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/featuredProducts/dtos"
)

func featuredItems(count int, placement string) []dtos.FeaturedProductInput {
	items := make([]dtos.FeaturedProductInput, 0, count)
	for range count {
		items = append(items, dtos.FeaturedProductInput{ProductId: uuid.NewString(), Placement: placement})
	}
	return items
}

func TestFeaturedProductsAcceptTwelveWithFourInTheMart(t *testing.T) {
	items := append(featuredItems(8, "storefront"), featuredItems(4, "mart")...)
	if err := ValidateReplaceFeaturedProducts(dtos.ReplaceFeaturedProductsRequest{Items: items}); err != nil {
		t.Fatalf("expected valid list, got %v", err)
	}
}

func TestFeaturedProductsRejectOverLimitsDuplicatesAndUnknownPlacements(t *testing.T) {
	duplicate := uuid.NewString()
	cases := map[string][]dtos.FeaturedProductInput{
		"thirteen":   featuredItems(13, "storefront"),
		"five mart":  featuredItems(5, "mart"),
		"duplicates": {{ProductId: duplicate, Placement: "mart"}, {ProductId: duplicate, Placement: "storefront"}},
		"placement":  {{ProductId: uuid.NewString(), Placement: "homepage"}},
		"bad id":     {{ProductId: "nope", Placement: "mart"}},
	}
	for name, items := range cases {
		if ValidateReplaceFeaturedProducts(dtos.ReplaceFeaturedProductsRequest{Items: items}) == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
}

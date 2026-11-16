package services_test

import (
	"testing"

	"nantty/modules/ads/src/services"
)

func TestMartTileServesOnlyProductCreativesInTheMartPlacement(t *testing.T) {
	placement, known := services.PlacementForSlotKind(services.SlotMartTile)
	if !known || placement != "mart" {
		t.Fatalf("martTile must map to the mart placement, got %q %v", placement, known)
	}
	if !services.CreativeFitsSlotKind("product", services.SlotMartTile) {
		t.Fatal("product creatives must fit the mart tile")
	}
	for _, format := range []string{"feed_post", "clip", "story", "live"} {
		if services.CreativeFitsSlotKind(format, services.SlotMartTile) {
			t.Fatalf("%s must not serve in the mart tile", format)
		}
	}
}

func TestFeedProductSlotServesOnlyProductCreativesInFeedPlacement(t *testing.T) {
	placement, known := services.PlacementForSlotKind(services.SlotFeedProduct)
	if !known || placement != "feed" {
		t.Fatalf("feedProduct must map to the feed placement, got %q %v", placement, known)
	}
	if !services.CreativeFitsSlotKind("product", services.SlotFeedProduct) {
		t.Fatal("product creatives must fit the feed product slot")
	}
	for _, format := range []string{"feed_post", "clip", "story", "live", "store"} {
		if services.CreativeFitsSlotKind(format, services.SlotFeedProduct) {
			t.Fatalf("%s must not serve in the feed product slot", format)
		}
	}
}

func TestSearchTileServesOnlyProductCreativesInSearchPlacement(t *testing.T) {
	placement, known := services.PlacementForSlotKind(services.SlotSearchTile)
	if !known || placement != "search" {
		t.Fatalf("searchTile must map to the search placement, got %q %v", placement, known)
	}
	if !services.CreativeFitsSlotKind("product", services.SlotSearchTile) {
		t.Fatal("product creatives must fit the search tile")
	}
	for _, format := range []string{"feed_post", "clip", "story", "live", "store"} {
		if services.CreativeFitsSlotKind(format, services.SlotSearchTile) {
			t.Fatalf("%s must not serve in the search tile", format)
		}
	}
}

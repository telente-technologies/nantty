package services

import "testing"

func TestMartTileServesOnlyProductCreativesInTheMartPlacement(t *testing.T) {
	placement, known := PlacementForSlotKind(SlotMartTile)
	if !known || placement != "mart" {
		t.Fatalf("martTile must map to the mart placement, got %q %v", placement, known)
	}
	if !CreativeFitsSlotKind("product", SlotMartTile) {
		t.Fatal("product creatives must fit the mart tile")
	}
	for _, format := range []string{"feed_post", "clip", "story", "live"} {
		if CreativeFitsSlotKind(format, SlotMartTile) {
			t.Fatalf("%s must not serve in the mart tile", format)
		}
	}
}

func TestFeedProductSlotServesOnlyProductCreativesInFeedPlacement(t *testing.T) {
	placement, known := PlacementForSlotKind(SlotFeedProduct)
	if !known || placement != "feed" {
		t.Fatalf("feedProduct must map to the feed placement, got %q %v", placement, known)
	}
	if !CreativeFitsSlotKind("product", SlotFeedProduct) {
		t.Fatal("product creatives must fit the feed product slot")
	}
	for _, format := range []string{"feed_post", "clip", "story", "live", "store"} {
		if CreativeFitsSlotKind(format, SlotFeedProduct) {
			t.Fatalf("%s must not serve in the feed product slot", format)
		}
	}
}

func TestSearchTileServesOnlyProductCreativesInSearchPlacement(t *testing.T) {
	placement, known := PlacementForSlotKind(SlotSearchTile)
	if !known || placement != "search" {
		t.Fatalf("searchTile must map to the search placement, got %q %v", placement, known)
	}
	if !CreativeFitsSlotKind("product", SlotSearchTile) {
		t.Fatal("product creatives must fit the search tile")
	}
	for _, format := range []string{"feed_post", "clip", "story", "live", "store"} {
		if CreativeFitsSlotKind(format, SlotSearchTile) {
			t.Fatalf("%s must not serve in the search tile", format)
		}
	}
}

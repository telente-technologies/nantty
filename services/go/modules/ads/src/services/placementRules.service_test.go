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

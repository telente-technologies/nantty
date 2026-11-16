package services_test

import (
	"testing"

	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
)

func TestLayersSurviveTheStoredJsonRoundTrip(t *testing.T) {
	text, colour := "Hello", "#ffffff"
	layers := []types.OverlayLayer{{Id: "a", Type: "text", Name: "Title", X: 10, Y: 10, Width: 200, Height: 80, ZIndex: 1, Opacity: 0.9, Text: &text, Color: &colour}}
	restored := services.LayersFromStored(services.LayersToStored(layers))
	if len(restored) != 1 || restored[0].Id != "a" || restored[0].Text == nil || *restored[0].Text != "Hello" || restored[0].Opacity != 0.9 {
		t.Fatalf("round trip lost data: %+v", restored)
	}
	if len(services.LayersFromStored(nil)) != 0 {
		t.Fatal("nil stays empty")
	}
}

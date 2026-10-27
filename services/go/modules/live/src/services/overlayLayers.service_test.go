package services

import (
	"strings"
	"testing"

	"nantty/modules/live/src/databases/schema"
	"nantty/modules/live/src/types"
)

func validLayer(identifier string) types.OverlayLayer {
	text, colour := "Hello", "#ffffff"
	return types.OverlayLayer{Id: identifier, Type: "text", Name: "Title", X: 10, Y: 10, Width: 200, Height: 80, ZIndex: 1, Opacity: 0.9, Text: &text, Color: &colour}
}

func TestValidateOverlayLayersAcceptsAWellFormedScene(t *testing.T) {
	source := "https://cdn.nantty.com/logo.png"
	logo := validLayer("logo")
	logo.Type, logo.Src = "image", &source
	if err := ValidateOverlayLayers([]types.OverlayLayer{validLayer("a"), logo}); err != nil {
		t.Fatalf("valid scene rejected: %v", err)
	}
	if err := ValidateOverlayLayers(nil); err != nil {
		t.Fatalf("an empty scene is valid: %v", err)
	}
}

func TestValidateOverlayLayersRejectsUnsafeOrOutOfRangeLayers(t *testing.T) {
	mutations := map[string]func(*types.OverlayLayer){
		"unknown type":     func(layer *types.OverlayLayer) { layer.Type = "script" },
		"bad id":           func(layer *types.OverlayLayer) { layer.Id = "has space" },
		"opacity":          func(layer *types.OverlayLayer) { layer.Opacity = 1.5 },
		"width":            func(layer *types.OverlayLayer) { layer.Width = 0 },
		"far away":         func(layer *types.OverlayLayer) { layer.X = 99999 },
		"zIndex":           func(layer *types.OverlayLayer) { layer.ZIndex = 5000 },
		"long text":        func(layer *types.OverlayLayer) { long := strings.Repeat("x", 501); layer.Text = &long },
		"font size":        func(layer *types.OverlayLayer) { size := 2.0; layer.FontSize = &size },
		"css injection":    func(layer *types.OverlayLayer) { bad := "red;background:url(x)"; layer.Color = &bad },
		"http image":       func(layer *types.OverlayLayer) { bad := "http://example.com/x.png"; layer.Src = &bad },
		"javascript image": func(layer *types.OverlayLayer) { bad := "javascript:alert(1)"; layer.Src = &bad },
		"credentials":      func(layer *types.OverlayLayer) { bad := "https://user:pass@example.com/x.png"; layer.Src = &bad },
	}
	for name, mutate := range mutations {
		layer := validLayer("a")
		mutate(&layer)
		if err := ValidateOverlayLayers([]types.OverlayLayer{layer}); err == nil {
			t.Fatalf("%s must be rejected", name)
		}
	}
	if err := ValidateOverlayLayers([]types.OverlayLayer{validLayer("a"), validLayer("a")}); err == nil {
		t.Fatalf("duplicate layer ids must be rejected")
	}
	many := make([]types.OverlayLayer, 51)
	for index := range many {
		many[index] = validLayer("layer" + strings.Repeat("a", index%10) + string(rune('a'+index%26)) + string(rune('a'+index/26)))
	}
	if err := ValidateOverlayLayers(many); err == nil {
		t.Fatalf("more than 50 layers must be rejected")
	}
}

func TestLayersSurviveTheStoredJsonRoundTrip(t *testing.T) {
	layers := []types.OverlayLayer{validLayer("a")}
	restored := layersFromStored(layersToStored(layers))
	if len(restored) != 1 || restored[0].Id != "a" || restored[0].Text == nil || *restored[0].Text != "Hello" || restored[0].Opacity != 0.9 {
		t.Fatalf("round trip lost data: %+v", restored)
	}
	if len(layersFromStored(nil)) != 0 {
		t.Fatalf("nil stays empty")
	}
}

func TestSceneIdentifiersAreOpaqueAndUnique(t *testing.T) {
	seen := map[string]bool{}
	for index := 0; index < 500; index++ {
		identifier := schema.NewOpaqueSceneIdentifier()
		if !strings.HasPrefix(identifier, "scn_") || len(identifier) != 28 || seen[identifier] {
			t.Fatalf("bad or repeated identifier %q", identifier)
		}
		seen[identifier] = true
	}
}

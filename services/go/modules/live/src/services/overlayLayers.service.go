package services

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"

	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"
	"nantty/platform/httpserver"
)

const (
	maximumOverlayLayers = 50
	maximumScenesPerLive = 10
	canvasWidth          = 1920.0
	canvasHeight         = 1080.0
)

var (
	overlayLayerTypes = []string{"text", "image", "shape", "countdown", "ticker"}
	layerIdPattern    = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	colourPattern     = regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|rgba?\([0-9., %]{5,40}\)|transparent)$`)
)

func ValidateOverlayLayers(layers []types.OverlayLayer) error {
	var issues []httpserver.ValidationIssue
	if len(layers) > maximumOverlayLayers {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "layers", Message: "a scene can have at most 50 layers"}})
	}
	seen := map[string]bool{}
	for index, layer := range layers {
		for _, message := range describeLayerProblems(layer) {
			issues = append(issues, httpserver.ValidationIssue{Path: fmt.Sprintf("layers[%d]", index), Message: message})
		}
		if seen[layer.Id] {
			issues = append(issues, httpserver.ValidationIssue{Path: fmt.Sprintf("layers[%d].id", index), Message: "must be unique in the scene"})
		}
		seen[layer.Id] = true
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func describeLayerProblems(layer types.OverlayLayer) []string {
	var problems []string
	if !layerIdPattern.MatchString(layer.Id) {
		problems = append(problems, "id must be 1-64 letters, digits, - or _")
	}
	if !slices.Contains(overlayLayerTypes, layer.Type) {
		problems = append(problems, "type must be one of "+strings.Join(overlayLayerTypes, ", "))
	}
	if len([]rune(layer.Name)) > 60 {
		problems = append(problems, "name must be at most 60 characters")
	}
	if layer.X < -canvasWidth || layer.X > 2*canvasWidth || layer.Y < -canvasHeight || layer.Y > 2*canvasHeight {
		problems = append(problems, "x and y must stay near the 1920x1080 canvas")
	}
	if layer.Width < 1 || layer.Width > 2*canvasWidth || layer.Height < 1 || layer.Height > 2*canvasHeight {
		problems = append(problems, "width and height must be between 1 and twice the canvas")
	}
	if layer.ZIndex < -100 || layer.ZIndex > 1000 {
		problems = append(problems, "zIndex must be between -100 and 1000")
	}
	if layer.Opacity < 0 || layer.Opacity > 1 {
		problems = append(problems, "opacity must be between 0 and 1")
	}
	if layer.Text != nil && len([]rune(*layer.Text)) > 500 {
		problems = append(problems, "text must be at most 500 characters")
	}
	if layer.FontSize != nil && (*layer.FontSize < 8 || *layer.FontSize > 400) {
		problems = append(problems, "fontSize must be between 8 and 400")
	}
	if layer.Radius != nil && (*layer.Radius < 0 || *layer.Radius > 2000) {
		problems = append(problems, "radius must be between 0 and 2000")
	}
	for name, colour := range map[string]*string{"color": layer.Color, "background": layer.Background} {
		if colour != nil && !colourPattern.MatchString(*colour) {
			problems = append(problems, name+" must be a hex or rgb(a) colour")
		}
	}
	if layer.Src != nil && !isSafeImageSource(*layer.Src) {
		problems = append(problems, "src must be an https image url")
	}
	return problems
}

func isSafeImageSource(source string) bool {
	if len(source) > 500 {
		return false
	}
	parsed, err := url.Parse(source)
	return err == nil && parsed.Scheme == "https" && parsed.Host != "" && parsed.User == nil
}

func layersToStored(layers []types.OverlayLayer) []map[string]any {
	encoded, _ := json.Marshal(layers)
	stored := []map[string]any{}
	_ = json.Unmarshal(encoded, &stored)
	return stored
}

func layersFromStored(stored []map[string]any) []types.OverlayLayer {
	layers := []types.OverlayLayer{}
	if len(stored) == 0 {
		return layers
	}
	encoded, _ := json.Marshal(stored)
	_ = json.Unmarshal(encoded, &layers)
	return layers
}

func requireSceneName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" || len([]rune(trimmed)) > 80 {
		return "", liveerrors.Unprocessable("SCENE_NAME_INVALID", "A scene name must be 1-80 characters.")
	}
	return trimmed, nil
}

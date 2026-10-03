package validators

import (
	"strings"

	"zudomart/modules/live/src/modules/overlays/dtos"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/utils"
)

func ValidateOverlaySceneRequest(body dtos.OverlaySceneRequest) error {
	var collected utils.Issues
	if body.Name != nil && (strings.TrimSpace(*body.Name) == "" || len([]rune(*body.Name)) > 80) {
		collected.Add("name", "must be 1-80 characters")
	}
	if err := collected.AsError(); err != nil {
		return err
	}
	if body.Layers != nil {
		return services.ValidateOverlayLayers(*body.Layers)
	}
	return nil
}

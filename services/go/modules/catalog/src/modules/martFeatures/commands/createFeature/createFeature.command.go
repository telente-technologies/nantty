package createfeature

import (
	"nantty/modules/catalog/src/modules/martFeatures/dtos"
	"nantty/modules/catalog/src/services"
)

type Command struct {
	Actor   services.StaffActor
	Request dtos.FeatureRequest
}

package createfeature

import (
	"zudomart/modules/catalog/src/modules/martFeatures/dtos"
	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor   services.StaffActor
	Request dtos.FeatureRequest
}

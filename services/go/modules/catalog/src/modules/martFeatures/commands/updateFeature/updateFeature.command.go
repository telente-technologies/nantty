package updatefeature

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/modules/martFeatures/dtos"
	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor     services.StaffActor
	FeatureId uuid.UUID
	Request   dtos.FeatureRequest
}

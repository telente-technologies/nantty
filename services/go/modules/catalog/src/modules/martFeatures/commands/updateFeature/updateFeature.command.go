package updatefeature

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/modules/martFeatures/dtos"
	"nantty/modules/catalog/src/services"
)

type Command struct {
	Actor     services.StaffActor
	FeatureId uuid.UUID
	Request   dtos.FeatureRequest
}

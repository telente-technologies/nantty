package movefeature

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor     services.StaffActor
	FeatureId uuid.UUID
	Direction string
}

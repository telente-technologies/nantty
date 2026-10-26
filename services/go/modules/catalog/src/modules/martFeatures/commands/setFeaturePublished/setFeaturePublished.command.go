package setfeaturepublished

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/services"
)

type Command struct {
	Actor     services.StaffActor
	FeatureId uuid.UUID
	Published bool
	Reason    string
}

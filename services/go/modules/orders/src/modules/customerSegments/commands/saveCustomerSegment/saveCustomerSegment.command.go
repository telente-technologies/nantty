package savecustomersegment

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/customerSegments/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	SegmentId *uuid.UUID
	Changes   dtos.CustomerSegmentChanges
}

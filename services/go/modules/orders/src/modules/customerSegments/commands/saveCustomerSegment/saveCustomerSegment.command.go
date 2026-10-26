package savecustomersegment

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/customerSegments/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	SegmentId *uuid.UUID
	Changes   dtos.CustomerSegmentChanges
}

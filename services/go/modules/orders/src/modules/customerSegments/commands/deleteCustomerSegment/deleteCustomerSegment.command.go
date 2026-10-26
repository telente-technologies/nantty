package deletecustomersegment

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	SegmentId uuid.UUID
}

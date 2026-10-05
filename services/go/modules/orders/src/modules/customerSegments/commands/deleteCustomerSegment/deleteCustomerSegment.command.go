package deletecustomersegment

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	SegmentId uuid.UUID
}

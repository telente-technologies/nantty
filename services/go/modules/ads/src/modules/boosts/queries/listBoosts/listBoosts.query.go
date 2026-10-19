package listboosts

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent/adboost"
)

type Query struct {
	UserId   uuid.UUID
	Statuses []adboost.Status
	Cursor   *uuid.UUID
	Limit    int
}

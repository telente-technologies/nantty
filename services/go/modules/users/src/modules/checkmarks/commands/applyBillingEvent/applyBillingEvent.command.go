package applybillingevent

import (
	"time"

	"zudomart/modules/users/src/modules/checkmarks/services"

	"github.com/google/uuid"
)

type Command struct {
	ProfileId uuid.UUID
	Event     string
	PeriodEnd *time.Time
	Price     *services.Price
}

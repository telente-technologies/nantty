package applybillingevent

import (
	"time"

	"github.com/google/uuid"
)

type Command struct {
	ProfileId uuid.UUID
	Event     string
	PeriodEnd *time.Time
}

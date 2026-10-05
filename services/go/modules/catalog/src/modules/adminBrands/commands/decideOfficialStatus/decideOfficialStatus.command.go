package decideofficialstatus

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor   services.StaffActor
	BrandId uuid.UUID
	Action  string
	Reason  string
}

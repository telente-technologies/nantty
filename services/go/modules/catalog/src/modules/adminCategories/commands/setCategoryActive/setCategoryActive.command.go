package setcategoryactive

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor      services.StaffActor
	CategoryId uuid.UUID
	Active     bool
	Reason     string
}

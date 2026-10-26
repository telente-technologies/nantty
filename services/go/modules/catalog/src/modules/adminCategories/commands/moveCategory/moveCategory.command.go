package movecategory

import (
	"github.com/google/uuid"

	"nantty/modules/catalog/src/services"
)

type Command struct {
	Actor      services.StaffActor
	CategoryId uuid.UUID
	Direction  string
}

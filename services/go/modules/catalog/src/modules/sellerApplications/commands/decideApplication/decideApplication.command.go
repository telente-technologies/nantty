package decideapplication

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor         services.StaffActor
	ApplicationId uuid.UUID
	Approve       bool
	Reason        string
}

package setstorestatus

import (
	"github.com/google/uuid"

	"zudomart/modules/catalog/src/services"
)

type Command struct {
	Actor   services.StaffActor
	StoreId uuid.UUID
	Status  string
	Reason  string
}

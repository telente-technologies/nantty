package replytoreview

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	ReviewId uuid.UUID
	ActorId  uuid.UUID
	Body     string
}

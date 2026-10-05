package deletedeliveryarea

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	AreaId uuid.UUID
}

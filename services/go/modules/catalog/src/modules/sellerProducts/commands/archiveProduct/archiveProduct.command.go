package archiveproduct

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store     commerceports.StoreAccess
	ProductId uuid.UUID
}

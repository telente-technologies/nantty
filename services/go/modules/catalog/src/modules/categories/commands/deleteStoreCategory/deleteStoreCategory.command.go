package deletestorecategory

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	CategoryId uuid.UUID
}

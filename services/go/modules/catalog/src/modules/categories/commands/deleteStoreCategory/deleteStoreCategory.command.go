package deletestorecategory

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	CategoryId uuid.UUID
}

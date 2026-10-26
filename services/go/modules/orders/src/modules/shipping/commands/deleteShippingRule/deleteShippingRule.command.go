package deleteshippingrule

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	RuleId uuid.UUID
}

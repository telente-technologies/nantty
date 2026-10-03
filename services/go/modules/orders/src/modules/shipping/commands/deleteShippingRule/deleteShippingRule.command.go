package deleteshippingrule

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	RuleId uuid.UUID
}

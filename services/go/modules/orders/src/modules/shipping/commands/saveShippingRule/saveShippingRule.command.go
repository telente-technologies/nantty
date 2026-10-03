package saveshippingrule

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/services"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	RuleId *uuid.UUID
	Input  services.RuleInput
}

package saveshippingrule

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	RuleId *uuid.UUID
	Input  services.RuleInput
}

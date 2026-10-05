package savedeliveryarea

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/deliveryAreas/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	AreaId *uuid.UUID
	Input  dtos.DeliveryAreaInput
}

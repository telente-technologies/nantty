package savedeliveryarea

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/deliveryAreas/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store  commerceports.StoreAccess
	AreaId *uuid.UUID
	Input  dtos.DeliveryAreaInput
}

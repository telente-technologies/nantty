package savecustomerprofile

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/customers/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	CustomerId *uuid.UUID
	Input      dtos.CustomerProfileInput
}

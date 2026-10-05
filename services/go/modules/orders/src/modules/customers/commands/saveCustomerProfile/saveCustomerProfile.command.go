package savecustomerprofile

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/customers/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store      commerceports.StoreAccess
	CustomerId *uuid.UUID
	Input      dtos.CustomerProfileInput
}

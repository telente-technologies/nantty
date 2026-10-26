package saveproductbundle

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	BundleId *uuid.UUID
	Request  dtos.ProductBundleRequest
}

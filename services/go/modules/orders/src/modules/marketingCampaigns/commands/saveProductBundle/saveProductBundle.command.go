package saveproductbundle

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/marketingCampaigns/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store    commerceports.StoreAccess
	BundleId *uuid.UUID
	Request  dtos.ProductBundleRequest
}

package saveflashsale

import (
	"github.com/google/uuid"

	"zudomart/modules/orders/src/modules/marketingCampaigns/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	FlashSaleId *uuid.UUID
	Request     dtos.FlashSaleRequest
}

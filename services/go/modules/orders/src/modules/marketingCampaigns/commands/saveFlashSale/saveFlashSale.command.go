package saveflashsale

import (
	"github.com/google/uuid"

	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store       commerceports.StoreAccess
	FlashSaleId *uuid.UUID
	Request     dtos.FlashSaleRequest
}

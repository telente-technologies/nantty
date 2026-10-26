package saverewardsettings

import (
	"nantty/modules/orders/src/modules/storeRewards/dtos"
	"nantty/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.RewardSettingsRequest
}

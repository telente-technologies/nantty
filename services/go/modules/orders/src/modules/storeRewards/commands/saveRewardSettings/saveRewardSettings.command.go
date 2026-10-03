package saverewardsettings

import (
	"zudomart/modules/orders/src/modules/storeRewards/dtos"
	"zudomart/platform/commerceports"
)

type Command struct {
	Store   commerceports.StoreAccess
	Request dtos.RewardSettingsRequest
}

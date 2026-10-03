package validators

import (
	"zudomart/modules/orders/src/modules/storeRewards/dtos"
	"zudomart/modules/orders/src/utils"
)

func ValidateRewardSettings(body dtos.RewardSettingsRequest) error {
	var collected utils.Issues
	collected.CheckRange("percentBackBasisPoints", body.PercentBackBasisPoints, 0, 2000)
	collected.CheckRange("expiryDays", body.ExpiryDays, 7, 730)
	if body.MinimumOrder.AmountMinor < 0 {
		collected.Add("minimumOrder", "must be zero or more")
	}
	if body.MaxPerOrder.AmountMinor < 0 {
		collected.Add("maxPerOrder", "must be zero or more")
	}
	return collected.AsError()
}

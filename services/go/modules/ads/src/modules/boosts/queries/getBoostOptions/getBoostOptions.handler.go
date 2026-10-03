package getboostoptions

import (
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(query Query) dtos.BoostOptions {
	minimum := handler.Container.Settings.BoostMinimumDailyMinor[query.Currency]
	return dtos.BoostOptions{
		MinimumDailyBudget: types.Money{AmountMinor: minimum, Currency: query.Currency}, SuggestedDailyBudgets: services.SuggestedDailyBudgets(minimum, query.Currency),
		DurationDayOptions: services.DurationDayOptions, Interests: services.BoostInterests,
	}
}

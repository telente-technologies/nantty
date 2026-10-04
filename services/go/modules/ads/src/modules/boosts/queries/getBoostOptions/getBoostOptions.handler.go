package getboostoptions

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/types"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) dtos.BoostOptions {
	countries := []string{}
	if query.Country != "" {
		countries = append(countries, query.Country)
	}
	minimum := handler.Container.Pricing.FloorsForCountries(ctx, countries, query.Currency).BoostMinimumDailyMinor
	return dtos.BoostOptions{
		MinimumDailyBudget: types.Money{AmountMinor: minimum, Currency: query.Currency}, SuggestedDailyBudgets: services.SuggestedDailyBudgets(minimum, query.Currency),
		DurationDayOptions: services.DurationDayOptions, Interests: services.BoostInterests,
	}
}

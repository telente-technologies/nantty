package getboostoptions

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/types"
	"zudomart/platform/regionpricing"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) dtos.BoostOptions {
	countries := []string{}
	if query.Country != "" {
		countries = append(countries, query.Country)
	}
	minimum := handler.Container.Pricing.FloorsForCountries(ctx, countries, query.Currency).BoostMinimumDailyMinor
	packages, _ := handler.Container.Pricing.BoostPackages(ctx, query.Country, query.Currency)
	region, _ := regionpricing.RegionForCountry(query.Country)
	if query.Country == "" {
		region, _ = regionpricing.RegionForCurrency(query.Currency)
	}
	return dtos.BoostOptions{
		MinimumDailyBudget: types.Money{AmountMinor: minimum, Currency: query.Currency}, SuggestedDailyBudgets: services.SuggestedDailyBudgets(minimum, query.Currency),
		DurationDayOptions: services.DurationDayOptions, Interests: services.BoostInterests, Region: region.Code, Packages: packages,
	}
}

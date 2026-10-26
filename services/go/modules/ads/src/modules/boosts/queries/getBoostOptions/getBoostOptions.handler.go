package getboostoptions

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/modules/boosts/services"
	"nantty/modules/ads/src/types"
	"nantty/platform/regionpricing"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.BoostOptions, error) {
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
	premium, err := handler.Container.Entitlements.IsPremium(ctx, query.UserId.String())
	if err != nil {
		handler.Container.Logger.Warn("premium status unavailable; free boosts hidden", "userId", query.UserId.String(), "error", err)
		premium = false
	}
	freeBoost, err := services.ReadFreeBoost(ctx, handler.Container, query.UserId, premium, types.Money{AmountMinor: minimum, Currency: query.Currency})
	if err != nil {
		return dtos.BoostOptions{}, err
	}
	adBalance, err := services.ReadAdBalanceSummary(ctx, handler.Container, query.UserId, query.Currency)
	if err != nil {
		return dtos.BoostOptions{}, err
	}
	return dtos.BoostOptions{
		MinimumDailyBudget: types.Money{AmountMinor: minimum, Currency: query.Currency}, SuggestedDailyBudgets: services.SuggestedDailyBudgets(minimum, query.Currency),
		DurationDayOptions: services.DurationDayOptions, Interests: services.BoostInterests, Region: region.Code, Packages: packages,
		PaymentMethods: services.PaymentMethodsFor(query.Platform, freeBoost.Premium), FreeBoost: freeBoost,
		PaymentOptions: services.BuildCreatePaymentOptions(ctx, handler.Container, query.UserId, query.Platform, freeBoost, adBalance), AdBalance: adBalance,
		MaximumDurationDays: services.MaximumDurationDays, MaximumScheduleDays: services.MaximumScheduleDays, GoalsByDestination: services.GoalsByDestination(),
	}, nil
}

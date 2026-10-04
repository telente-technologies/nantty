package estimateboost

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/modules/boosts/validators"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.BoostEstimate, error) {
	floors := handler.Container.Pricing.FloorsForCountries(ctx, services.BoostTargetCountries(query.Request.Audience), query.Request.DailyBudget.Currency)
	if err := validators.ValidateEstimate(query.Request, floors.BoostMinimumDailyMinor); err != nil {
		return dtos.BoostEstimate{}, err
	}
	estimate, err := handler.Container.Pricing.Estimate(ctx, services.EstimateRequestForBoost(query.Request))
	if err != nil {
		return dtos.BoostEstimate{}, err
	}
	return services.EstimateBoost(query.Request, estimate), nil
}

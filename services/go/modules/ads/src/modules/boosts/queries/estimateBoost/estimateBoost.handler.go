package estimateboost

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/modules/boosts/services"
	"nantty/modules/ads/src/modules/boosts/validators"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.BoostEstimate, error) {
	query.Request = services.NormalizeBoostBudget(services.NormalizeBoostDestination(query.Request))
	floors := handler.Container.Pricing.FloorsForCountries(ctx, services.BoostTargetCountries(query.Request.Audience), query.Request.DailyBudget.Currency)
	if err := validators.ValidateEstimate(query.Request, floors.BoostMinimumDailyMinor, handler.Container.Now()); err != nil {
		return dtos.BoostEstimate{}, err
	}
	estimate, err := handler.Container.Pricing.Estimate(ctx, services.EstimateRequestForBoost(query.Request))
	if err != nil {
		return dtos.BoostEstimate{}, err
	}
	quoted := services.EstimateBoost(query.Request, estimate)
	quoted.TotalCost.AmountMinor = services.BoostTotalBudgetMinor(query.Request)
	return quoted, nil
}

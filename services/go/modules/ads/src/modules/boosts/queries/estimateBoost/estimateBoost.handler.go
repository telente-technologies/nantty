package estimateboost

import (
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/modules/boosts/validators"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(query Query) (dtos.BoostEstimate, error) {
	settings := handler.Container.Settings
	if err := validators.ValidateEstimate(query.Request, settings.BoostMinimumDailyMinor); err != nil {
		return dtos.BoostEstimate{}, err
	}
	return services.EstimateBoost(query.Request, settings.ReservePerMilleMinor[query.Request.DailyBudget.Currency]), nil
}

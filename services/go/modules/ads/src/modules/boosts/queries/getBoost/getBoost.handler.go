package getboost

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.Boost, error) {
	row, err := handler.Container.Client.AdBoost.Query().Where(adboost.ID(query.BoostId), adboost.UserID(query.UserId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.Boost{}, adserrors.NotFound
	}
	if err != nil {
		return dtos.Boost{}, err
	}
	account, err := handler.Container.Client.AdAccount.Get(ctx, row.AccountID)
	if err != nil {
		return dtos.Boost{}, err
	}
	return services.PresentBoost(ctx, handler.Container.Client, row, adsservices.DayKeyInTimezone(handler.Container.Now(), account.Timezone))
}

package getadvertiser

import (
	"context"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AdvertiserDetail, error) {
	account, err := handler.Container.Client.AdAccount.Get(ctx, query.AccountId)
	if ent.IsNotFound(err) {
		return dtos.AdvertiserDetail{}, adserrors.NotFound
	}
	if err != nil {
		return dtos.AdvertiserDetail{}, err
	}
	return services.LoadAdvertiserDetail(ctx, handler.Container, account)
}

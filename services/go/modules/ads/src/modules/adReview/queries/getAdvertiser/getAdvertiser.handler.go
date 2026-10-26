package getadvertiser

import (
	"context"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
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

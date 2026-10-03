package getpromotion

import (
	"context"
	"net/http"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/promotion"
	"zudomart/modules/orders/src/modules/promotions/dtos"
	"zudomart/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.PromotionView, error) {
	row, err := handler.Container.Client.Promotion.Query().Where(promotion.ID(query.PromotionId), promotion.StoreID(query.Store.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.PromotionView{}, ordererrors.Api(http.StatusNotFound, "PROMOTION_NOT_FOUND", "That promotion could not be found.")
	}
	if err != nil {
		return dtos.PromotionView{}, err
	}
	return services.PromotionView(row, query.Store.Currency, handler.Container.Now()), nil
}

package deletepromotion

import (
	"context"
	"net/http"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent/promotion"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	deleted, err := handler.Container.Client.Promotion.Delete().Where(promotion.ID(command.PromotionId), promotion.StoreID(command.Store.StoreId)).Exec(ctx)
	if err != nil {
		return err
	}
	if deleted == 0 {
		return ordererrors.Api(http.StatusNotFound, "PROMOTION_NOT_FOUND", "That promotion could not be found.")
	}
	return nil
}

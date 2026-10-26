package deletedeliveryarea

import (
	"context"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/deliveryarea"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		removed, err := tx.DeliveryArea.Delete().Where(deliveryarea.ID(command.AreaId), deliveryarea.StoreID(command.Store.StoreId)).Exec(ctx)
		if err != nil {
			return err
		}
		if removed == 0 {
			return ordererrors.DeliveryAreaNotFound
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.delivery_area_removed", command.Store.StoreId.String(), handler.Container.Now(),
			map[string]any{"storeId": command.Store.StoreId, "areaId": command.AreaId})
	})
}

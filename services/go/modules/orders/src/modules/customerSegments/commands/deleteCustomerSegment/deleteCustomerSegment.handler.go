package deletecustomersegment

import (
	"context"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/customersegment"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		removed, err := tx.CustomerSegment.Delete().Where(customersegment.ID(command.SegmentId), customersegment.StoreID(command.Store.StoreId)).Exec(ctx)
		if err != nil {
			return err
		}
		if removed == 0 {
			return ordererrors.SegmentNotFound
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.customer_segment_removed", command.Store.StoreId.String(), handler.Container.Now(), map[string]any{"storeId": command.Store.StoreId, "segmentId": command.SegmentId})
	})
}

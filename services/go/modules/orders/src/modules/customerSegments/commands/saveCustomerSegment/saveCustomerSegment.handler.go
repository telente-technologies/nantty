package savecustomersegment

import (
	"context"
	"strings"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/customersegment"
	"zudomart/modules/orders/src/services"
)

const maximumCustomSegments = 20

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.SegmentView, error) {
	var saved *ent.CustomerSegment
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		changes := command.Changes
		var err error
		if command.SegmentId == nil {
			count, countError := tx.CustomerSegment.Query().Where(customersegment.StoreID(command.Store.StoreId)).Count(ctx)
			if countError != nil {
				return countError
			}
			if count >= maximumCustomSegments {
				return ordererrors.SegmentLimitReached
			}
			saved, err = tx.CustomerSegment.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(*changes.Name)).
				SetDescription(strings.TrimSpace(*changes.Description)).SetRules(*changes.Rules).Save(ctx)
		} else {
			current, findError := tx.CustomerSegment.Query().Where(customersegment.ID(*command.SegmentId), customersegment.StoreID(command.Store.StoreId)).Only(ctx)
			if ent.IsNotFound(findError) {
				return ordererrors.SegmentNotFound
			}
			if findError != nil {
				return findError
			}
			update := current.Update()
			if changes.Name != nil {
				update.SetName(strings.TrimSpace(*changes.Name))
			}
			if changes.Description != nil {
				update.SetDescription(strings.TrimSpace(*changes.Description))
			}
			if changes.Rules != nil {
				update.SetRules(*changes.Rules)
			}
			saved, err = update.Save(ctx)
		}
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.customer_segment_saved", command.Store.StoreId.String(), handler.Container.Now(), map[string]any{"storeId": command.Store.StoreId, "segmentId": saved.ID})
	})
	if err != nil {
		return services.SegmentView{}, err
	}
	customers, err := services.LoadStoreCustomers(ctx, handler.Container, command.Store.StoreId, command.Store.Currency)
	if err != nil {
		return services.SegmentView{}, err
	}
	definition := services.CustomSegment(saved.ID.String(), saved.Name, saved.Description, saved.Rules, saved.CreatedAt, handler.Container.Now())
	return definition.Present(customers, command.Store.Currency), nil
}

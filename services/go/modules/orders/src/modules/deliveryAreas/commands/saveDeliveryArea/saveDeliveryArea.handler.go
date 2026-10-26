package savedeliveryarea

import (
	"context"
	"strings"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/deliveryarea"
	"nantty/modules/orders/src/modules/deliveryAreas/dtos"
	"nantty/modules/orders/src/modules/deliveryAreas/services"
	"nantty/modules/orders/src/modules/deliveryAreas/validators"
)

const maximumDeliveryAreas = 50

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.DeliveryAreaView, error) {
	var saved *ent.DeliveryArea
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		values := command.Input.MergedOver(dtos.DeliveryAreaValues{})
		if command.AreaId != nil {
			current, err := tx.DeliveryArea.Query().Where(deliveryarea.ID(*command.AreaId), deliveryarea.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
			if ent.IsNotFound(err) {
				return ordererrors.DeliveryAreaNotFound
			}
			if err != nil {
				return err
			}
			values = command.Input.MergedOver(services.ValuesOf(current))
		}
		if err := validators.ValidateDeliveryAreaValues(values); err != nil {
			return err
		}
		values.Cities = services.CleanCities(values.Cities)
		var err error
		if command.AreaId == nil {
			count, countError := tx.DeliveryArea.Query().Where(deliveryarea.StoreID(command.Store.StoreId)).Count(ctx)
			if countError != nil {
				return countError
			}
			if count >= maximumDeliveryAreas {
				return ordererrors.DeliveryAreaLimitReached
			}
			saved, err = tx.DeliveryArea.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(values.Name)).SetState(strings.TrimSpace(values.State)).
				SetCities(values.Cities).SetFeeMinor(values.FeeMinor).SetCurrency(string(command.Store.Currency)).SetEstimatedDaysMin(values.EstimatedDaysMin).
				SetEstimatedDaysMax(values.EstimatedDaysMax).SetActive(values.Active).Save(ctx)
		} else {
			saved, err = tx.DeliveryArea.UpdateOneID(*command.AreaId).SetName(strings.TrimSpace(values.Name)).SetState(strings.TrimSpace(values.State)).
				SetCities(values.Cities).SetFeeMinor(values.FeeMinor).SetEstimatedDaysMin(values.EstimatedDaysMin).SetEstimatedDaysMax(values.EstimatedDaysMax).
				SetActive(values.Active).Save(ctx)
		}
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.delivery_area_saved", command.Store.StoreId.String(), handler.Container.Now(),
			map[string]any{"storeId": command.Store.StoreId, "areaId": saved.ID, "active": saved.Active})
	})
	if err != nil {
		return dtos.DeliveryAreaView{}, err
	}
	return services.PresentDeliveryArea(saved), nil
}

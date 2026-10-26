package changeflashsalestate

import (
	"context"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/flashsale"
	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/modules/orders/src/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.FlashSaleView, error) {
	var saved *ent.FlashSale
	now := handler.Container.Now()
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.FlashSale.Query().Where(flashsale.ID(command.FlashSaleId), flashsale.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if services.FlashSaleStatus(existing, now) == "ended" {
			return ordererrors.Api(409, "FLASH_SALE_ENDED", "This flash sale has already ended.")
		}
		update := existing.Update()
		switch command.Action {
		case "pause":
			update.SetPaused(true)
		case "resume":
			update.SetPaused(false)
		case "end":
			update.SetEndedAt(now)
		}
		if saved, err = update.Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "flashSale.saved", saved.ID.String(), now, map[string]any{"flashSaleId": saved.ID, "storeId": saved.StoreID, "action": command.Action})
	})
	if err != nil {
		return dtos.FlashSaleView{}, err
	}
	views, err := services.PresentFlashSales(ctx, handler.Container, []*ent.FlashSale{saved})
	if err != nil {
		return dtos.FlashSaleView{}, err
	}
	return views[0], nil
}

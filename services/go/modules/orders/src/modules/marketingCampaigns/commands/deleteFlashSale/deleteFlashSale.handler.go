package deleteflashsale

import (
	"context"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/flashsale"
	"zudomart/modules/orders/src/generated/ent/flashsaleitem"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.FlashSale.Query().Where(flashsale.ID(command.FlashSaleId), flashsale.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.ErrNotFound
		}
		if err != nil {
			return err
		}
		if services.FlashSaleStatus(existing, handler.Container.Now()) == "active" {
			return ordererrors.Api(409, "FLASH_SALE_ACTIVE", "End the flash sale before deleting it.")
		}
		if _, err := tx.FlashSaleItem.Delete().Where(flashsaleitem.FlashSaleID(existing.ID)).Exec(ctx); err != nil {
			return err
		}
		return tx.FlashSale.DeleteOne(existing).Exec(ctx)
	})
}

package saveflashsale

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/events"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/flashsale"
	"nantty/modules/orders/src/generated/ent/flashsaleitem"
	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/modules/orders/src/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

var ErrFlashSaleEnded = ordererrors.Api(409, "FLASH_SALE_ENDED", "This flash sale has ended and can no longer be edited.")

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.FlashSaleView, error) {
	request := command.Request
	productIds := make([]uuid.UUID, 0, len(request.Items))
	for _, item := range request.Items {
		productIds = append(productIds, uuid.MustParse(item.ProductId))
	}
	products, err := services.LoadCampaignProducts(ctx, handler.Container, command.Store.StoreId, productIds)
	if err != nil {
		return dtos.FlashSaleView{}, err
	}
	if err := services.RequirePurchasableCampaignProducts(products, productIds); err != nil {
		return dtos.FlashSaleView{}, err
	}
	var collected utils.Issues
	for index, item := range request.Items {
		if item.SalePriceMinor >= products[productIds[index]].RegularPriceMinor {
			collected.Add("items."+strconv.Itoa(index)+".salePriceMinor", "must be below the product's regular price")
		}
	}
	if err := collected.AsError(); err != nil {
		return dtos.FlashSaleView{}, err
	}
	var saved *ent.FlashSale
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		soldBefore := map[uuid.UUID]int{}
		if command.FlashSaleId == nil {
			saved, err = tx.FlashSale.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(*request.Name)).SetStartsAt(*request.StartsAt).SetEndsAt(*request.EndsAt).
				SetCurrency(string(command.Store.Currency)).Save(ctx)
			if err != nil {
				return err
			}
		} else {
			existing, err := tx.FlashSale.Query().Where(flashsale.ID(*command.FlashSaleId), flashsale.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
			if ent.IsNotFound(err) {
				return httpserver.ErrNotFound
			}
			if err != nil {
				return err
			}
			if services.FlashSaleStatus(existing, handler.Container.Now()) == "ended" {
				return ErrFlashSaleEnded
			}
			previous, err := tx.FlashSaleItem.Query().Where(flashsaleitem.FlashSaleID(existing.ID)).All(ctx)
			if err != nil {
				return err
			}
			for _, item := range previous {
				soldBefore[item.ProductID] = item.SoldCount
			}
			if _, err := tx.FlashSaleItem.Delete().Where(flashsaleitem.FlashSaleID(existing.ID)).Exec(ctx); err != nil {
				return err
			}
			if saved, err = existing.Update().SetName(strings.TrimSpace(*request.Name)).SetStartsAt(*request.StartsAt).SetEndsAt(*request.EndsAt).Save(ctx); err != nil {
				return err
			}
		}
		for index, item := range request.Items {
			productId := productIds[index]
			if err := tx.FlashSaleItem.Create().SetFlashSaleID(saved.ID).SetStoreID(command.Store.StoreId).SetProductID(productId).SetPosition(index + 1).SetSalePriceMinor(item.SalePriceMinor).
				SetOriginalPriceMinor(products[productId].RegularPriceMinor).SetNillableStockCap(item.StockCap).SetSoldCount(soldBefore[productId]).Exec(ctx); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "flashSale.saved", saved.ID.String(), handler.Container.Now(), map[string]any{
			"flashSaleId": saved.ID, "storeId": saved.StoreID, "startsAt": saved.StartsAt, "endsAt": saved.EndsAt, "productIds": productIds,
		})
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

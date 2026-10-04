package saveproductbundle

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/productbundle"
	"zudomart/modules/orders/src/generated/ent/productbundleitem"
	"zudomart/modules/orders/src/modules/marketingCampaigns/dtos"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ProductBundleView, error) {
	request := command.Request
	productIds := make([]uuid.UUID, 0, len(request.Items))
	for _, item := range request.Items {
		productIds = append(productIds, uuid.MustParse(item.ProductId))
	}
	products, err := services.LoadCampaignProducts(ctx, handler.Container, command.Store.StoreId, productIds)
	if err != nil {
		return dtos.ProductBundleView{}, err
	}
	if err := services.RequirePurchasableCampaignProducts(products, productIds); err != nil {
		return dtos.ProductBundleView{}, err
	}
	var regular int64
	for index, item := range request.Items {
		regular += products[productIds[index]].RegularPriceMinor * int64(item.Quantity)
	}
	if request.BundlePriceMinor >= regular {
		return dtos.ProductBundleView{}, utils.Issues{{Path: "bundlePriceMinor", Message: "must be below the regular total"}}.AsError()
	}
	var saved *ent.ProductBundle
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if command.BundleId == nil {
			saved, err = tx.ProductBundle.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(request.Name)).SetDescription(strings.TrimSpace(request.Description)).
				SetBundlePriceMinor(request.BundlePriceMinor).SetCurrency(string(command.Store.Currency)).SetStatus(request.Status).Save(ctx)
		} else {
			existing, findError := tx.ProductBundle.Query().Where(productbundle.ID(*command.BundleId), productbundle.StoreID(command.Store.StoreId)).ForUpdate().Only(ctx)
			if ent.IsNotFound(findError) {
				return httpserver.ErrNotFound
			}
			if findError != nil {
				return findError
			}
			if _, err := tx.ProductBundleItem.Delete().Where(productbundleitem.BundleID(existing.ID)).Exec(ctx); err != nil {
				return err
			}
			saved, err = existing.Update().SetName(strings.TrimSpace(request.Name)).SetDescription(strings.TrimSpace(request.Description)).SetBundlePriceMinor(request.BundlePriceMinor).SetStatus(request.Status).Save(ctx)
		}
		if err != nil {
			return err
		}
		for index, item := range request.Items {
			if err := tx.ProductBundleItem.Create().SetBundleID(saved.ID).SetProductID(productIds[index]).SetPosition(index + 1).SetQuantity(item.Quantity).Exec(ctx); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "productBundle.saved", saved.ID.String(), handler.Container.Now(), map[string]any{
			"bundleId": saved.ID, "storeId": saved.StoreID, "status": saved.Status, "productIds": productIds,
		})
	})
	if err != nil {
		return dtos.ProductBundleView{}, err
	}
	views, err := services.PresentProductBundles(ctx, handler.Container, []*ent.ProductBundle{saved})
	if err != nil {
		return dtos.ProductBundleView{}, err
	}
	return views[0], nil
}

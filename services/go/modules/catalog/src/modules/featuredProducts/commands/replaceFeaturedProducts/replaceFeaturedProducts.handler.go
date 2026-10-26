package replacefeaturedproducts

import (
	"context"
	"strconv"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/featuredproduct"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/modules/featuredProducts/dtos"
	"nantty/modules/catalog/src/modules/featuredProducts/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (httpserver.CursorPage[dtos.FeaturedProductView], error) {
	productIds := make([]uuid.UUID, 0, len(command.Request.Items))
	for _, item := range command.Request.Items {
		productIds = append(productIds, uuid.MustParse(item.ProductId))
	}
	if err := handler.requireActiveStoreProducts(ctx, command.Store.StoreId, productIds); err != nil {
		return httpserver.CursorPage[dtos.FeaturedProductView]{}, err
	}
	now := handler.Container.Now()
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.FeaturedProduct.Query().Where(featuredproduct.StoreID(command.Store.StoreId)).All(ctx)
		if err != nil {
			return err
		}
		previous := map[uuid.UUID]*ent.FeaturedProduct{}
		for _, row := range existing {
			previous[row.ProductID] = row
		}
		if _, err := tx.FeaturedProduct.Delete().Where(featuredproduct.StoreID(command.Store.StoreId)).Exec(ctx); err != nil {
			return err
		}
		for index, item := range command.Request.Items {
			create := tx.FeaturedProduct.Create().SetStoreID(command.Store.StoreId).SetProductID(productIds[index]).SetPlacement(item.Placement).SetPosition(index + 1).SetFeaturedSince(now)
			if kept, found := previous[productIds[index]]; found {
				create.SetFeaturedSince(kept.FeaturedSince).SetViewCount(kept.ViewCount).SetClickCount(kept.ClickCount)
			}
			if err := create.Exec(ctx); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", command.Store.StoreId.String(), now, map[string]any{"storeId": command.Store.StoreId, "featuredProductIds": productIds})
	})
	if err != nil {
		return httpserver.CursorPage[dtos.FeaturedProductView]{}, err
	}
	views, err := services.ListFeaturedProductViews(ctx, handler.Container, command.Store.StoreId)
	return httpserver.NewCursorPage(views, ""), err
}

func (handler Handler) requireActiveStoreProducts(ctx context.Context, storeId uuid.UUID, productIds []uuid.UUID) error {
	if len(productIds) == 0 {
		return nil
	}
	active, err := handler.Container.Client.Product.Query().Where(product.IDIn(productIds...), product.StoreID(storeId), product.Status(enums.ProductActive)).IDs(ctx)
	if err != nil {
		return err
	}
	found := map[uuid.UUID]bool{}
	for _, identifier := range active {
		found[identifier] = true
	}
	issues := utils.Issues{}
	for index, identifier := range productIds {
		if !found[identifier] {
			issues.Add("items."+strconv.Itoa(index)+".productId", "must be an active product of this store")
		}
	}
	return issues.AsError()
}

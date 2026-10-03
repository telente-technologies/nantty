package services

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/platform/sellerplans"
)

func checkActiveProductCap(ctx context.Context, deployed *container.Container, write ProductWrite) error {
	if write.Request.Status != enums.ProductActive || sellerplans.Default.AllowAll {
		return nil
	}
	limit := sellerplans.LimitsFor(sellerplans.Default.PlanOf(ctx, write.Store.OwnerAccountId)).MaxActiveProducts
	if limit == 0 {
		return nil
	}
	if write.ProductId != nil {
		if current, err := deployed.Client.Product.Get(ctx, *write.ProductId); err == nil && current.Status == enums.ProductActive {
			return nil
		}
	}
	active, err := deployed.Client.Product.Query().Where(product.StoreID(write.Store.StoreId), product.Status(enums.ProductActive)).Count(ctx)
	if err != nil {
		return err
	}
	if active >= limit {
		return catalogerrors.ProductLimitReached
	}
	return nil
}

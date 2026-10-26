package getproductusage

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/platform/sellerplans"
)

type Handler struct {
	Container *container.Container
}

type Usage struct {
	ActiveProducts    int  `json:"activeProducts"`
	DraftProducts     int  `json:"draftProducts"`
	ScheduledProducts int  `json:"scheduledProducts"`
	ArchivedProducts  int  `json:"archivedProducts"`
	MaxActiveProducts *int `json:"maxActiveProducts"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Usage, error) {
	base := func() *ent.ProductQuery {
		return handler.Container.Client.Product.Query().Where(product.StoreID(query.StoreId))
	}
	var usage Usage
	var err error
	if usage.ActiveProducts, err = base().Where(product.Status(enums.ProductActive)).Count(ctx); err != nil {
		return usage, err
	}
	if usage.DraftProducts, err = base().Where(product.Status(enums.ProductDraft), product.PublishAtIsNil()).Count(ctx); err != nil {
		return usage, err
	}
	if usage.ScheduledProducts, err = base().Where(product.Status(enums.ProductDraft), product.PublishAtNotNil()).Count(ctx); err != nil {
		return usage, err
	}
	if !sellerplans.Default.AllowAll {
		if limit := sellerplans.LimitsFor(sellerplans.Default.PlanOf(ctx, query.OwnerAccountId)).MaxActiveProducts; limit > 0 {
			usage.MaxActiveProducts = &limit
		}
	}
	usage.ArchivedProducts, err = base().Where(product.Status(enums.ProductArchived)).Count(ctx)
	return usage, err
}

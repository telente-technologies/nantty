package getstoredetail

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.StoreDetailView, error) {
	row, err := handler.Container.Client.Store.Get(ctx, query.StoreId)
	if ent.IsNotFound(err) || (err == nil && (row.Status != enums.StoreActive || !enums.IsShownToBuyers(row.ModerationVisibility))) {
		return types.StoreDetailView{}, catalogerrors.StoreNotFound
	}
	if err != nil {
		return types.StoreDetailView{}, err
	}
	conditions := services.WithRegionCondition([]predicate.Product{product.StoreID(row.ID), product.Status(enums.ProductActive), product.PublishedOnline(true),
		product.Visibility(enums.VisibilityPublic), product.ModerationVisibilityIn(enums.ModerationVisible, enums.ModerationRestricted)}, services.ViewerCountry(ctx, handler.Container, query.Viewer), query.Viewer)
	count, err := handler.Container.Client.Product.Query().Where(conditions...).Count(ctx)
	if err != nil {
		return types.StoreDetailView{}, err
	}
	summaries, err := services.LoadStoreSummaries(ctx, handler.Container, []*ent.Store{row})
	if err != nil {
		return types.StoreDetailView{}, err
	}
	return types.StoreDetailView{
		StoreSummaryView: summaries[row.ID], OwnerUserId: row.OwnerAccountID.String(), BannerUrl: row.BannerURL, Handle: row.Slug, Bio: row.Description,
		ProductsCount: count, Verified: row.Verified, JoinedAt: row.CreatedAt, CountryCode: row.CountryCode, Currency: row.Currency,
		BusinessProfileId: row.BusinessProfileID.String(), Posts: []any{},
	}, nil
}

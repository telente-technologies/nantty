package getstoredetail

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/predicate"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/store"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.StoreDetailView, error) {
	lookup := handler.Container.Client.Store.Query().Where(store.ID(query.StoreId))
	if query.Slug != "" {
		lookup = handler.Container.Client.Store.Query().Where(store.Slug(query.Slug))
	}
	row, err := lookup.Only(ctx)
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
	followers, isFollowing := 0, false
	if handler.Container.StoreFollows != nil {
		followers, isFollowing = handler.Container.StoreFollows.StoreFollowStats(ctx, row.ID, query.Viewer)
	}
	return types.StoreDetailView{
		StoreSummaryView: summaries[row.ID], OwnerUserId: row.OwnerAccountID.String(), BannerUrl: row.BannerURL, Handle: row.Slug, Bio: row.Description,
		ProductsCount: count, Verified: row.Verified, JoinedAt: row.CreatedAt, CountryCode: row.CountryCode, Currency: row.Currency,
		BusinessProfileId: row.BusinessProfileID.String(), Posts: []any{}, Followers: followers, IsFollowing: isFollowing,
	}, nil
}

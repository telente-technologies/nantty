package getsharecard

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/money"
)

type Handler struct {
	Container *container.Container
}

type ShareCard struct {
	Title        string       `json:"title"`
	Subtitle     string       `json:"subtitle"`
	ImageUrl     *string      `json:"imageUrl"`
	Price        *money.Money `json:"price,omitempty"`
	InStock      *bool        `json:"inStock,omitempty"`
	StoreName    *string      `json:"storeName,omitempty"`
	Verified     *bool        `json:"verified,omitempty"`
	Availability string       `json:"availability"`
}

var unavailable = ShareCard{Availability: "unavailable"}

func (handler Handler) Execute(ctx context.Context, query Query) (ShareCard, error) {
	if query.Kind == "store" {
		return handler.storeCard(ctx, query)
	}
	return handler.productCard(ctx, query)
}

func (handler Handler) storeCard(ctx context.Context, query Query) (ShareCard, error) {
	row, err := handler.Container.Client.Store.Get(ctx, query.Id)
	if ent.IsNotFound(err) || (err == nil && row.Status != enums.StoreActive) {
		return unavailable, nil
	}
	if err != nil {
		return ShareCard{}, err
	}
	verified := row.Verified
	return ShareCard{Title: row.Name, Subtitle: row.Description, ImageUrl: row.LogoURL, Verified: &verified, Availability: "available"}, nil
}

func (handler Handler) productCard(ctx context.Context, query Query) (ShareCard, error) {
	row, err := handler.Container.Client.Product.Get(ctx, query.Id)
	if ent.IsNotFound(err) {
		return unavailable, nil
	}
	if err != nil {
		return ShareCard{}, err
	}
	store, err := handler.Container.Client.Store.Get(ctx, row.StoreID)
	if err != nil || store.Status != enums.StoreActive || row.Status != enums.ProductActive || !row.PublishedOnline {
		return unavailable, nil
	}
	if row.Visibility == enums.VisibilityStoreOnly {
		return ShareCard{Availability: "private"}, nil
	}
	summaries, err := services.LoadProductSummaries(ctx, handler.Container, []*ent.Product{row}, nil)
	if err != nil {
		return ShareCard{}, err
	}
	inStock, verified := summaries[0].Stock > 0, store.Verified
	return ShareCard{
		Title: row.Name, Subtitle: store.Name, ImageUrl: summaries[0].ImageUrl, Price: &summaries[0].Price, InStock: &inStock,
		StoreName: &store.Name, Verified: &verified, Availability: "available",
	}, nil
}

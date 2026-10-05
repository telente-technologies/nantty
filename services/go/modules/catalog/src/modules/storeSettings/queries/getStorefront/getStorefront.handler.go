package getstorefront

import (
	"context"

	"zudomart/modules/catalog/src/container"
	featuredservices "zudomart/modules/catalog/src/modules/featuredProducts/services"
	"zudomart/modules/catalog/src/modules/storeSettings/dtos"
	"zudomart/modules/catalog/src/modules/storeSettings/services"
	"zudomart/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StorefrontView, error) {
	row, err := handler.Container.Client.Store.Get(ctx, query.Store.StoreId)
	if err != nil {
		return dtos.StorefrontView{}, err
	}
	featured, err := featuredservices.ListFeaturedProductViews(ctx, handler.Container, row.ID)
	if err != nil {
		return dtos.StorefrontView{}, err
	}
	products := make([]dtos.StorefrontFeaturedProductView, 0, len(featured))
	for _, item := range featured {
		products = append(products, dtos.StorefrontFeaturedProductView{ProductId: item.ProductId, Name: item.ProductName, ImageUrl: item.ImageUrl, Price: item.Price, IsAvailable: true})
	}
	var areas []string
	if reader, portError := commerceports.Default.DeliveryAreaNamesReader(); portError == nil {
		if areas, err = reader.DeliveryAreaNamesForStore(ctx, row.ID); err != nil {
			return dtos.StorefrontView{}, err
		}
	}
	return services.PresentStorefront(row, products, areas, handler.Container.Settings.PublicWebBaseUrl), nil
}

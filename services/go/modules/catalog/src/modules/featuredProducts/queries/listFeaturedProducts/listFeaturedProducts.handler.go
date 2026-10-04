package listfeaturedproducts

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/modules/featuredProducts/dtos"
	"zudomart/modules/catalog/src/modules/featuredProducts/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.FeaturedProductView], error) {
	views, err := services.ListFeaturedProductViews(ctx, handler.Container, query.StoreId)
	return httpserver.NewCursorPage(views, ""), err
}

package listfeaturedproducts

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/featuredProducts/dtos"
	"nantty/modules/catalog/src/modules/featuredProducts/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.FeaturedProductView], error) {
	views, err := services.ListFeaturedProductViews(ctx, handler.Container, query.StoreId)
	return httpserver.NewCursorPage(views, ""), err
}

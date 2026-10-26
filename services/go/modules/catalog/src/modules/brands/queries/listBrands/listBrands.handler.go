package listbrands

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brand"
	brandservices "nantty/modules/catalog/src/modules/brands/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[brandservices.BrandSummary], error) {
	request := handler.Container.Client.Brand.Query().Where(brand.Active(true))
	if query.Text != "" {
		request = request.Where(brand.NameContainsFold(query.Text))
	}
	rows, err := request.Order(ent.Asc(brand.FieldName)).Limit(200).All(ctx)
	if err != nil {
		return httpserver.CursorPage[brandservices.BrandSummary]{}, err
	}
	views, err := brandservices.SummarizeAll(ctx, handler.Container, rows)
	return httpserver.NewCursorPage(views, ""), err
}

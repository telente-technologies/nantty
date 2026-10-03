package listbrands

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/types"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.BrandView], error) {
	request := handler.Container.Client.Brand.Query().Where(brand.Active(true))
	if query.Text != "" {
		request = request.Where(brand.NameContainsFold(query.Text))
	}
	rows, err := request.Order(ent.Asc(brand.FieldName)).Limit(200).All(ctx)
	if err != nil {
		return httpserver.CursorPage[types.BrandView]{}, err
	}
	views := make([]types.BrandView, 0, len(rows))
	for _, row := range rows {
		views = append(views, types.BrandView{Id: row.ID.String(), Name: row.Name, Slug: row.Slug, LogoUrl: row.LogoURL, Official: row.Official})
	}
	return httpserver.NewCursorPage(views, ""), nil
}

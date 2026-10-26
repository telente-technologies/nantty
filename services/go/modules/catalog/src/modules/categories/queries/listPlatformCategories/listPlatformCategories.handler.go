package listplatformcategories

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (httpserver.CursorPage[types.CategoryView], error) {
	rows, err := handler.Container.Client.Category.Query().Where(category.StoreIDIsNil(), category.Active(true)).
		Order(ent.Asc(category.FieldPath), ent.Asc(category.FieldSortOrder)).All(ctx)
	if err != nil {
		return httpserver.CursorPage[types.CategoryView]{}, err
	}
	views := make([]types.CategoryView, 0, len(rows))
	for _, row := range rows {
		views = append(views, services.CategoryViewOf(row))
	}
	return httpserver.NewCursorPage(views, ""), nil
}

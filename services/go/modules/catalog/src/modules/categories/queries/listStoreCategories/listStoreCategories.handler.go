package liststorecategories

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.CategoryView], error) {
	empty := httpserver.CursorPage[types.CategoryView]{}
	rows, err := handler.Container.Client.Category.Query().Where(category.StoreID(query.StoreId)).Order(ent.Asc(category.FieldName)).All(ctx)
	if err != nil {
		return empty, err
	}
	products, err := handler.Container.Client.Product.Query().Where(product.StoreID(query.StoreId), product.StatusNEQ(enums.ProductArchived), product.CategoryIDNotNil()).
		Select(product.FieldCategoryID).All(ctx)
	if err != nil {
		return empty, err
	}
	counts := map[uuid.UUID]int{}
	for _, row := range products {
		counts[*row.CategoryID]++
	}
	views := make([]types.CategoryView, 0, len(rows))
	for _, row := range rows {
		view := services.CategoryViewOf(row)
		count := counts[row.ID]
		view.ProductCount = &count
		views = append(views, view)
	}
	return httpserver.NewCursorPage(views, ""), nil
}

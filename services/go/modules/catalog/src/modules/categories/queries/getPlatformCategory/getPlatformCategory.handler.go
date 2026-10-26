package getplatformcategory

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
	"nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/types"
)

type Query struct {
	CategoryId uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.CategoryView, error) {
	row, err := handler.Container.Client.Category.Query().Where(category.ID(query.CategoryId), category.StoreIDIsNil(), category.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.CategoryView{}, catalogerrors.CategoryNotFound
	}
	if err != nil {
		return types.CategoryView{}, err
	}
	return services.CategoryViewOf(row), nil
}

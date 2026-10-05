package getplatformcategory

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
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

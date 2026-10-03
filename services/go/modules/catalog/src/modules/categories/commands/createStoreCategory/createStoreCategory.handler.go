package createstorecategory

import (
	"context"
	"strings"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/types"
)

const categoryLimitPerStore = 100

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CategoryView, error) {
	name := strings.TrimSpace(command.Request.Name)
	count, err := handler.Container.Client.Category.Query().Where(category.StoreID(command.Store.StoreId)).Count(ctx)
	if err != nil {
		return types.CategoryView{}, err
	}
	if count >= categoryLimitPerStore {
		return types.CategoryView{}, catalogerrors.CategoryLimitReached
	}
	duplicate, err := handler.Container.Client.Category.Query().Where(category.StoreID(command.Store.StoreId), category.NameEqualFold(name)).Exist(ctx)
	if err != nil || duplicate {
		return types.CategoryView{}, firstError(err, catalogerrors.CategoryExists)
	}
	zero := 0
	row, err := handler.Container.Client.Category.Create().SetStoreID(command.Store.StoreId).SetName(name).SetSlug(services.Slugify(name)).
		SetDescription(command.Request.Description).Save(ctx)
	if ent.IsConstraintError(err) {
		return types.CategoryView{}, catalogerrors.CategoryExists
	}
	if err != nil {
		return types.CategoryView{}, err
	}
	view := services.CategoryViewOf(row)
	view.ProductCount = &zero
	return view, nil
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}

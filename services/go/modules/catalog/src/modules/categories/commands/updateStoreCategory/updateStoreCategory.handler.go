package updatestorecategory

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

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.CategoryView, error) {
	row, err := handler.Container.Client.Category.Query().Where(category.ID(command.CategoryId), category.StoreID(command.Store.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.CategoryView{}, catalogerrors.CategoryNotFound
	}
	if err != nil {
		return types.CategoryView{}, err
	}
	name := strings.TrimSpace(command.Request.Name)
	clash, err := handler.Container.Client.Category.Query().Where(category.StoreID(command.Store.StoreId), category.NameEqualFold(name), category.IDNEQ(row.ID)).Exist(ctx)
	if err != nil || clash {
		if err == nil {
			err = catalogerrors.CategoryExists
		}
		return types.CategoryView{}, err
	}
	updated, err := row.Update().SetName(name).SetSlug(services.Slugify(name)).SetDescription(command.Request.Description).Save(ctx)
	if ent.IsConstraintError(err) {
		return types.CategoryView{}, catalogerrors.CategoryExists
	}
	if err != nil {
		return types.CategoryView{}, err
	}
	return services.CategoryViewOf(updated), nil
}

package getcategorysearchsource

import (
	"context"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/modules/internalSources/dtos"
	"zudomart/modules/catalog/src/modules/internalSources/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.CategorySearchSource, error) {
	row, err := handler.Container.Client.Category.Get(ctx, query.CategoryId)
	if ent.IsNotFound(err) || (err == nil && row.StoreID != nil) {
		return dtos.CategorySearchSource{}, catalogerrors.CategoryNotFound
	}
	if err != nil {
		return dtos.CategorySearchSource{}, err
	}
	path, err := services.CategoryNamesAlongPath(ctx, handler.Container, row.Path)
	if err != nil {
		return dtos.CategorySearchSource{}, err
	}
	if len(path) == 0 {
		path = []string{row.Name}
	}
	return dtos.CategorySearchSource{CategoryId: row.ID.String(), Name: row.Name, Synonyms: []string{row.Slug}, Path: path, Active: row.Active, CreatedAt: services.Timestamp(row.CreatedAt)}, nil
}

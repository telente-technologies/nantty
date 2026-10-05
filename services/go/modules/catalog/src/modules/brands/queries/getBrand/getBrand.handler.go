package getbrand

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	brandservices "zudomart/modules/catalog/src/modules/brands/services"
)

type Query struct {
	BrandId uuid.UUID
	Viewer  *uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (brandservices.BrandDetail, error) {
	row, err := handler.Container.Client.Brand.Query().Where(brand.ID(query.BrandId), brand.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return brandservices.BrandDetail{}, catalogerrors.NotFound
	}
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	return brandservices.Detail(ctx, handler.Container, row, query.Viewer)
}

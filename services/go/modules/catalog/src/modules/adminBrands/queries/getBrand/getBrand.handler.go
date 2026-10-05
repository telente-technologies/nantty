package getbrand

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	brandservices "zudomart/modules/catalog/src/modules/adminBrands/services"
)

type Query struct {
	BrandId uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (brandservices.BrandDetail, error) {
	row, err := handler.Container.Client.Brand.Get(ctx, query.BrandId)
	if ent.IsNotFound(err) {
		return brandservices.BrandDetail{}, catalogerrors.NotFound
	}
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	return brandservices.Detail(ctx, handler.Container, row)
}

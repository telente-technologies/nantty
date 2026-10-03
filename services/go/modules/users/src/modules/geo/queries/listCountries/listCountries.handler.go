package listcountries

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]*ent.GeoCountry, error) {
	return handler.Container.Client.GeoCountry.Query().Order(ent.Asc("name")).All(ctx)
}

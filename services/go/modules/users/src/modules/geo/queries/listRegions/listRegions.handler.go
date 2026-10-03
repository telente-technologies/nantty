package listregions

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/georegion"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]*ent.GeoRegion, error) {
	return handler.Container.Client.GeoRegion.Query().Where(georegion.CountryID(query.CountryId)).Order(ent.Asc(georegion.FieldName)).All(ctx)
}

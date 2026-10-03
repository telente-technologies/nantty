package listcities

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/geocity"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]*ent.GeoCity, error) {
	request := handler.Container.Client.GeoCity.Query().Order(ent.Asc(geocity.FieldName))
	if query.AdminArea != nil {
		request = request.Where(geocity.AdminAreaID(*query.AdminArea))
	}
	if query.RegionId != nil {
		request = request.Where(geocity.RegionID(*query.RegionId))
	}
	return request.All(ctx)
}

package listadminareas

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/geoadminarea"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]*ent.GeoAdminArea, error) {
	return handler.Container.Client.GeoAdminArea.Query().Where(geoadminarea.RegionID(query.RegionId)).Order(ent.Asc(geoadminarea.FieldName)).All(ctx)
}

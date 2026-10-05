package getfeature

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	featureservices "zudomart/modules/catalog/src/modules/martFeatures/services"
	"zudomart/modules/catalog/src/services"
)

type Query struct {
	FeatureId uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (any, error) {
	row, err := handler.Container.Client.MartFeature.Get(ctx, query.FeatureId)
	if ent.IsNotFound(err) {
		return nil, catalogerrors.NotFound
	}
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"item":    featureservices.Present(handler.Container.Settings, row, handler.Container.Now()),
		"history": services.StaffHistory(ctx, handler.Container, featureservices.SubjectType, row.ID.String()),
	}, nil
}

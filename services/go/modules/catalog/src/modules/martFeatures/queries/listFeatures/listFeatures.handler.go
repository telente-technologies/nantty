package listfeatures

import (
	"context"

	"zudomart/modules/catalog/src/container"
	featureservices "zudomart/modules/catalog/src/modules/martFeatures/services"
)

type Query struct{}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (any, error) {
	views, err := featureservices.PresentAll(ctx, handler.Container)
	return map[string]any{"items": views}, err
}

package listfeatures

import (
	"context"

	"nantty/modules/catalog/src/container"
	featureservices "nantty/modules/catalog/src/modules/martFeatures/services"
)

type Query struct{}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (any, error) {
	views, err := featureservices.PresentAll(ctx, handler.Container)
	return map[string]any{"items": views}, err
}

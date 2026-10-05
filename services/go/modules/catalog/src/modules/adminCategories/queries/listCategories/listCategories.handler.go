package listcategories

import (
	"context"

	"zudomart/modules/catalog/src/container"
	categoryservices "zudomart/modules/catalog/src/modules/adminCategories/services"
)

type Query struct{}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) (any, error) {
	views, err := categoryservices.PresentAll(ctx, handler.Container)
	return map[string]any{"items": views}, err
}

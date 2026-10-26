package getimagelibrary

import (
	"context"

	"nantty/modules/catalog/src/container"
	featureservices "nantty/modules/catalog/src/modules/martFeatures/services"
)

type Query struct{}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(_ context.Context, _ Query) (any, error) {
	countries := handler.Container.Settings.MartCountries
	if countries == nil {
		countries = []string{}
	}
	return map[string]any{"items": featureservices.ImageLibrary(handler.Container.Settings), "countries": countries}, nil
}

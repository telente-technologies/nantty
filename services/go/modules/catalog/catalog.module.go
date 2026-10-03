package catalog

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewCatalogModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "catalog"}, nil
}

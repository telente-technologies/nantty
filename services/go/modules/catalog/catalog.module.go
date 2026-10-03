package catalog

import (
	"context"

	"zudomart/modules/catalog/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewCatalogModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewCatalogModule(ctx, dependencies)
}

package catalog

import (
	"context"

	"nantty/modules/catalog/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewCatalogModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewCatalogModule(ctx, dependencies)
}

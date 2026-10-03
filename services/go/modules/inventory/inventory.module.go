package inventory

import (
	"context"

	"zudomart/modules/inventory/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewInventoryModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewInventoryModule(ctx, dependencies)
}

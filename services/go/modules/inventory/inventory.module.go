package inventory

import (
	"context"

	"nantty/modules/inventory/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewInventoryModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewInventoryModule(ctx, dependencies)
}

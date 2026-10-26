package orders

import (
	"context"

	"nantty/modules/orders/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewOrdersModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewOrdersModule(ctx, dependencies)
}

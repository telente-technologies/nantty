package orders

import (
	"context"

	"zudomart/modules/orders/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewOrdersModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewOrdersModule(ctx, dependencies)
}

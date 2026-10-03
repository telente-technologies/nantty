package payments

import (
	"context"

	"zudomart/modules/payments/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewPaymentsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewPaymentsModule(ctx, dependencies)
}

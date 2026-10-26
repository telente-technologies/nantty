package payments

import (
	"context"

	"nantty/modules/payments/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewPaymentsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewPaymentsModule(ctx, dependencies)
}

package escrow

import (
	"context"

	"zudomart/modules/escrow/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewEscrowModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewEscrowModule(ctx, dependencies)
}

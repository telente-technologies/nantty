package escrow

import (
	"context"

	"nantty/modules/escrow/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewEscrowModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewEscrowModule(ctx, dependencies)
}

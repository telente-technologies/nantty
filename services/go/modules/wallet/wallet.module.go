package wallet

import (
	"context"

	"nantty/modules/wallet/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewWalletModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewWalletModule(ctx, dependencies)
}

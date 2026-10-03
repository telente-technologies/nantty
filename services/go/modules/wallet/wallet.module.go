package wallet

import (
	"context"

	"zudomart/modules/wallet/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewWalletModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewWalletModule(ctx, dependencies)
}

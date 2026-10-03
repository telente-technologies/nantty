package wallet

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewWalletModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "wallet"}, nil
}

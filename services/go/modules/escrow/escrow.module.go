package escrow

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewEscrowModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "escrow"}, nil
}

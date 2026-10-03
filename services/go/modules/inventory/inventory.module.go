package inventory

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewInventoryModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "inventory"}, nil
}

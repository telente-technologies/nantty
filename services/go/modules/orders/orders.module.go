package orders

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewOrdersModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "orders"}, nil
}

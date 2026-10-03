package currency

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewCurrencyModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "currency"}, nil
}

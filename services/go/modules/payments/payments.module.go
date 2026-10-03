package payments

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewPaymentsModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "payments"}, nil
}

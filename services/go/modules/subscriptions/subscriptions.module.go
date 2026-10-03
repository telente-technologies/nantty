package subscriptions

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewSubscriptionsModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "subscriptions"}, nil
}

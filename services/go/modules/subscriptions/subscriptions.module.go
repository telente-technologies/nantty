package subscriptions

import (
	"context"

	"zudomart/modules/subscriptions/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewSubscriptionsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewSubscriptionsModule(ctx, dependencies)
}

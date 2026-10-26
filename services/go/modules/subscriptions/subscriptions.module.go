package subscriptions

import (
	"context"

	"nantty/modules/subscriptions/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewSubscriptionsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewSubscriptionsModule(ctx, dependencies)
}

package ads

import (
	"context"

	"nantty/modules/ads/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewAdsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewAdsModule(ctx, dependencies)
}

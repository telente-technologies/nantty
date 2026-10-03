package ads

import (
	"context"

	"zudomart/modules/ads/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewAdsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewAdsModule(ctx, dependencies)
}

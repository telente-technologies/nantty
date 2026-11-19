package analytics

import (
	"context"

	"nantty/modules/analytics/src"
	"nantty/platform/servicemodule"
)

func NewAnalyticsModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewAnalyticsModule(ctx, dependencies)
}

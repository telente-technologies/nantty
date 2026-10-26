package analytics

import (
	"context"

	"nantty/platform/servicemodule"
)

func NewAnalyticsModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "analytics"}, nil
}

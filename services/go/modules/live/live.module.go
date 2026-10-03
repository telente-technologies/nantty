package live

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewLiveModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "live"}, nil
}

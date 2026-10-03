package ads

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewAdsModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "ads"}, nil
}

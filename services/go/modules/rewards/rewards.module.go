package rewards

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewRewardsModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "rewards"}, nil
}

package listretentionpolicies

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/retention/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]*ent.RetentionPolicy, error) {
	return services.LoadRetentionPolicies(ctx, handler.Container.Client)
}

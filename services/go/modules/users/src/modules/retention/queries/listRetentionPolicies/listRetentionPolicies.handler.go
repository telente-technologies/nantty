package listretentionpolicies

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/retention/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]*ent.RetentionPolicy, error) {
	return services.LoadRetentionPolicies(ctx, handler.Container.Client)
}

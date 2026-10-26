package deleteshippingrule

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return services.DeleteShippingRule(ctx, handler.Container, command.Store, command.RuleId)
}

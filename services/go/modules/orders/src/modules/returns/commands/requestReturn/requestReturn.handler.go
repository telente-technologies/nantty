package requestreturn

import (
	"context"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/modules/returns/dtos"
	"nantty/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ReturnView, error) {
	lines := make([]schema.ReturnLine, 0, len(command.Request.Lines))
	for _, line := range command.Request.Lines {
		lines = append(lines, schema.ReturnLine{OrderItemId: line.OrderItemId, Quantity: line.Quantity})
	}
	row, err := services.RequestReturn(ctx, handler.Container, command.BuyerId, command.OrderId, lines, command.Request.Reason)
	if err != nil {
		return dtos.ReturnView{}, err
	}
	views, err := services.ReturnViews(ctx, handler.Container, []*ent.ReturnRequest{row})
	return views[0], err
}

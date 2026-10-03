package receivereturn

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/modules/returns/dtos"
	"zudomart/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.ReturnView, error) {
	if err := services.ReceiveReturn(ctx, handler.Container, command.Seller, command.ReturnId, command.LocationId); err != nil {
		return dtos.ReturnView{}, err
	}
	row, err := handler.Container.Client.ReturnRequest.Get(ctx, command.ReturnId)
	if err != nil {
		return dtos.ReturnView{}, err
	}
	views, err := services.ReturnViews(ctx, handler.Container, []*ent.ReturnRequest{row})
	return views[0], err
}

package getadminorder

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/modules/adminOrders/dtos"
	"nantty/modules/orders/src/modules/adminOrders/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.OrderDetail, error) {
	condition := ordergroup.ReferenceEqualFold(query.IdOrNumber)
	if identifier, err := uuid.Parse(query.IdOrNumber); err == nil {
		condition = ordergroup.ID(identifier)
	}
	group, err := handler.Container.Client.OrderGroup.Query().Where(condition).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.OrderDetail{}, ordererrors.OrderNotFound
	}
	if err != nil {
		return dtos.OrderDetail{}, err
	}
	return services.Detail(ctx, handler.Container, group)
}

package getescrowfororder

import (
	"context"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/dispute"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/generated/ent/escrowevent"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/escrow/src/modules/escrows/dtos"
	"nantty/modules/escrow/src/modules/escrows/services"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.EscrowDetailDto, error) {
	container := handler.Application.Container
	client := container.Client(container.Resources.Database)
	held, err := client.Escrow.Query().Where(escrow.OrderID(query.OrderId)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.EscrowDetailDto{}, services.ErrEscrowNotFound
	}
	if err != nil {
		return dtos.EscrowDetailDto{}, err
	}
	if !query.AsStaff && held.BuyerUserID != query.ViewerUserId && held.SellerUserID != query.ViewerUserId {
		return dtos.EscrowDetailDto{}, services.ErrEscrowNotFound
	}
	events, err := client.EscrowEvent.Query().Where(escrowevent.EscrowID(held.ID)).Order(ent.Asc(escrowevent.FieldCreatedAt), ent.Asc(escrowevent.FieldID)).All(ctx)
	if err != nil {
		return dtos.EscrowDetailDto{}, err
	}
	var disputeId *string
	latest, err := client.Dispute.Query().Where(dispute.EscrowID(held.ID)).Order(ent.Desc(dispute.FieldCreatedAt)).First(ctx)
	if err == nil {
		identifier := latest.ID.String()
		disputeId = &identifier
	} else if !ent.IsNotFound(err) {
		return dtos.EscrowDetailDto{}, err
	}
	detail := services.ConvertEscrowToDetail(held, container.Policy(ctx).AutoReleasePeriod, disputeId, events)
	detail.RefundScheduled, err = handler.Application.Escrows.ScheduledRefundView(ctx, client, held.ID)
	return detail, err
}

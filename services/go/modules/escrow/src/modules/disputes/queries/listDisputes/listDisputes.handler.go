package listdisputes

import (
	"context"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/dispute"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/disputes/dtos"
	"nantty/modules/escrow/src/modules/disputes/services"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/platform/httpserver"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.DisputeDto], error) {
	client := handler.Application.Container.Client(handler.Application.Container.Resources.Database)
	request := client.Dispute.Query()
	if query.StoreId != "" {
		request.Where(dispute.HasEscrowWith(escrow.StoreID(query.StoreId)))
	} else if !query.AsStaff {
		request.Where(dispute.HasEscrowWith(escrow.Or(escrow.BuyerUserID(query.ViewerUserId), escrow.SellerUserID(query.ViewerUserId))))
	}
	if query.Status != "" {
		request.Where(dispute.StatusEQ(dispute.Status(query.Status)))
	}
	if query.AfterId != nil {
		request.Where(dispute.IDLT(*query.AfterId))
	}
	rows, err := request.Order(ent.Desc(dispute.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.DisputeDto]{}, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	views := make([]dtos.DisputeDto, 0, len(rows))
	for _, row := range rows {
		held, err := client.Escrow.Get(ctx, row.EscrowID)
		if err != nil {
			return httpserver.CursorPage[dtos.DisputeDto]{}, err
		}
		role := "support"
		if query.StoreId != "" {
			role = "seller"
		} else if !query.AsStaff {
			role, _ = services.ParticipantRole(held, query.ViewerUserId)
		}
		view, err := services.LoadDisputeView(ctx, client, row, held, role)
		if err != nil {
			return httpserver.CursorPage[dtos.DisputeDto]{}, err
		}
		views = append(views, view)
	}
	return httpserver.NewCursorPage(views, nextCursor), nil
}

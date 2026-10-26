package listsellerescrowholds

import (
	"context"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/escrow/src/modules/escrows/dtos"
	"nantty/modules/escrow/src/modules/escrows/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.EscrowHoldDto], error) {
	container := handler.Application.Container
	request := container.Client(container.Resources.Database).Escrow.Query().
		Where(escrow.SellerUserID(query.SellerUserId), escrow.StatusIn(escrow.StatusHeld, escrow.StatusDisputed))
	if query.AfterId != nil {
		request.Where(escrow.IDLT(*query.AfterId))
	}
	rows, err := request.Order(ent.Desc(escrow.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.EscrowHoldDto]{}, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	holds := make([]dtos.EscrowHoldDto, len(rows))
	for index, row := range rows {
		holds[index] = services.ConvertEscrowToSellerHold(row, container.Policy(ctx).AutoReleasePeriod)
	}
	return httpserver.NewCursorPage(holds, nextCursor), nil
}

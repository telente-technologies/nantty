package closedispute

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/modules/disputes/dtos"
	getdispute "nantty/modules/escrow/src/modules/disputes/queries/getDispute"
	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/ledger/src/databases"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.DisputeDto, error) {
	var view dtos.DisputeDto
	err := databases.RunInMoneyTransaction(ctx, handler.Application.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		closed, err := handler.Application.Disputes.CloseDisputeByBuyerInTransaction(ctx, transaction, command.BuyerUserId, command.DisputeId)
		if err != nil {
			return err
		}
		view, err = getdispute.LoadDisputeForViewer(ctx, handler.Application, transaction, getdispute.Query{DisputeId: closed.ID, ViewerUserId: command.BuyerUserId})
		return err
	})
	return view, err
}

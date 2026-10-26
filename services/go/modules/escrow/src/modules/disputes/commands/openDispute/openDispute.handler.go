package opendispute

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/modules/disputes/dtos"
	getdispute "nantty/modules/escrow/src/modules/disputes/queries/getDispute"
	"nantty/modules/escrow/src/modules/escrows"
	ledgerutils "nantty/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.DisputeDto, bool, error) {
	application := handler.Application
	input := command.Input
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.DisputeDto]{
		Scope: input.BuyerUserId + ":disputes.open", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.OrderId, input.Reason, input.Description, input.EvidenceUrls),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.DisputeDto, error) {
			opened, err := application.Disputes.OpenDisputeInTransaction(ctx, transaction, input)
			if err != nil {
				return dtos.DisputeDto{}, err
			}
			return getdispute.LoadDisputeForViewer(ctx, application, transaction, getdispute.Query{DisputeId: opened.ID, ViewerUserId: input.BuyerUserId})
		},
	})
}

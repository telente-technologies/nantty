package opendispute

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/modules/disputes/dtos"
	"zudomart/modules/escrow/src/modules/disputes/queries/getDispute"
	"zudomart/modules/escrow/src/modules/escrows"
	ledgerutils "zudomart/modules/ledger/src/utils"
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

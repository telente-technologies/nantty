package resolvedispute

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/modules/disputes/dtos"
	"zudomart/modules/escrow/src/modules/disputes/queries/getDispute"
	"zudomart/modules/escrow/src/modules/escrows"
	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.DisputeDto, bool, error) {
	application := handler.Application
	input := command.Input
	var settlement escrowservices.EscrowSettlementResult
	view, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.DisputeDto]{
		Scope: "staff:" + input.StaffId + ":disputes.resolve", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.DisputeId, input.Outcome, input.RefundMinor, input.Note),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.DisputeDto, error) {
			resolved, result, err := application.Disputes.ResolveDisputeInTransaction(ctx, transaction, input)
			if err != nil {
				return dtos.DisputeDto{}, err
			}
			settlement = result
			return getdispute.LoadDisputeForViewer(ctx, application, transaction, getdispute.Query{DisputeId: resolved.ID, AsStaff: true})
		},
	})
	if err == nil && !replayed {
		application.Escrows.SendRefundToProviderAfterCommit(ctx, settlement)
	}
	return view, replayed, err
}

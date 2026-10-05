package resolvedispute

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/modules/disputes/dtos"
	getstaffdispute "zudomart/modules/escrow/src/modules/disputes/queries/getStaffDispute"
	"zudomart/modules/escrow/src/modules/escrows"
	escrowservices "zudomart/modules/escrow/src/modules/escrows/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StaffDisputeDetailDto, bool, error) {
	application := handler.Application
	input := command.Input
	var settlement escrowservices.EscrowSettlementResult
	view, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.StaffDisputeDetailDto]{
		Scope: "staff:" + input.StaffId + ":disputes.resolve", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.DisputeId, input.Outcome, input.RefundMinor, input.RefundCurrency, input.Note),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.StaffDisputeDetailDto, error) {
			resolved, result, err := application.Disputes.ResolveDisputeInTransaction(ctx, transaction, input)
			if err != nil {
				return dtos.StaffDisputeDetailDto{}, err
			}
			settlement = result
			return getstaffdispute.LoadStaffDispute(ctx, application, transaction, resolved.ID)
		},
	})
	if err == nil && !replayed {
		application.Escrows.SendRefundToProviderAfterCommit(ctx, settlement)
	}
	return view, replayed, err
}

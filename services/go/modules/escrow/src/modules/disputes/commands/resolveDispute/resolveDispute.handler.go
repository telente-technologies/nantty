package resolvedispute

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/modules/disputes/dtos"
	getstaffdispute "nantty/modules/escrow/src/modules/disputes/queries/getStaffDispute"
	"nantty/modules/escrow/src/modules/escrows"
	ledgerutils "nantty/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StaffDisputeDetailDto, bool, error) {
	application := handler.Application
	input := command.Input
	view, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.StaffDisputeDetailDto]{
		Scope: "staff:" + input.StaffId + ":disputes.resolve", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.DisputeId, input.Outcome, input.RefundMinor, input.RefundCurrency, input.Note),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.StaffDisputeDetailDto, error) {
			resolved, _, err := application.Disputes.ResolveDisputeInTransaction(ctx, transaction, input)
			if err != nil {
				return dtos.StaffDisputeDetailDto{}, err
			}
			return getstaffdispute.LoadStaffDispute(ctx, application, transaction, resolved.ID)
		},
	})
	return view, replayed, err
}

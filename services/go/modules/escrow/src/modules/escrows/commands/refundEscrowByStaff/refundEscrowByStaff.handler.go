package refundescrowbystaff

import (
	"context"
	"database/sql"

	"nantty/modules/escrow/src/modules/escrows"
	"nantty/modules/escrow/src/modules/escrows/dtos"
	"nantty/modules/escrow/src/modules/escrows/services"
	ledgerutils "nantty/modules/ledger/src/utils"
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.EscrowDetailDto, bool, error) {
	application := handler.Application
	var settlement services.EscrowSettlementResult
	detail, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.EscrowDetailDto]{
		Scope: "staff:" + command.StaffId + ":escrow.refund", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.OrderId, command.Reason),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.EscrowDetailDto, error) {
			var err error
			actor := services.EscrowActor{Type: "staff", Id: command.StaffId}
			settlement, err = application.Escrows.RefundEscrowInTransaction(ctx, transaction, command.OrderId, command.Reason, actor)
			if err != nil {
				return dtos.EscrowDetailDto{}, err
			}
			if !settlement.AlreadySettled {
				if err := application.Escrows.RecordStaffDecisionInTransaction(ctx, transaction, settlement.Escrow, "refund", command.Reason, actor); err != nil {
					return dtos.EscrowDetailDto{}, err
				}
			}
			return services.ConvertEscrowToDetail(settlement.Escrow, application.Container.Policy(ctx).AutoReleasePeriod, nil, nil), nil
		},
	})
	return detail, replayed, err
}

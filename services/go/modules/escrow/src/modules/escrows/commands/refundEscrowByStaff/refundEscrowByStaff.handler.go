package refundescrowbystaff

import (
	"context"
	"database/sql"

	"zudomart/modules/escrow/src/modules/escrows"
	"zudomart/modules/escrow/src/modules/escrows/dtos"
	"zudomart/modules/escrow/src/modules/escrows/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
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
			settlement, err = application.Escrows.RefundEscrowInTransaction(ctx, transaction, command.OrderId, command.Reason, services.EscrowActor{Type: "staff", Id: command.StaffId})
			if err != nil {
				return dtos.EscrowDetailDto{}, err
			}
			return services.ConvertEscrowToDetail(settlement.Escrow, application.Container.Policy(ctx).AutoReleasePeriod, nil, nil), nil
		},
	})
	return detail, replayed, err
}

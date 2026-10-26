package releaseescrowbystaff

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
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.EscrowDetailDto]{
		Scope: "staff:" + command.StaffId + ":escrow.release", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.OrderId, command.Reason),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.EscrowDetailDto, error) {
			settlement, err := application.Escrows.ReleaseEscrowAfterStaffReviewInTransaction(ctx, transaction, command.OrderId, command.Reason, services.EscrowActor{Type: "staff", Id: command.StaffId})
			if err != nil {
				return dtos.EscrowDetailDto{}, err
			}
			return services.ConvertEscrowToDetail(settlement.Escrow, application.Container.Policy(ctx).AutoReleasePeriod, nil, nil), nil
		},
	})
}

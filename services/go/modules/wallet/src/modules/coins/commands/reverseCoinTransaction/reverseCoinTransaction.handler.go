package reversecointransaction

import (
	"context"
	"database/sql"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/services"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (bool, error) {
	container := handler.Application.Container
	reversal, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, container.Resources.Database, container.Idempotency, ledgerutils.IdempotentCommand[services.CoinReversal]{
		Scope: "staff:" + command.StaffId + ":coins.reverse", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.TransactionId, command.Reason),
		Execute: func(ctx context.Context, transaction *sql.Tx) (services.CoinReversal, error) {
			return handler.Application.Reviews.ReverseInTransaction(ctx, transaction, command.StaffId, command.TransactionId, command.Reason)
		},
	})
	if err == nil && !replayed {
		handler.Application.Reviews.SendRefundAfterCommit(ctx, reversal)
	}
	return replayed, err
}

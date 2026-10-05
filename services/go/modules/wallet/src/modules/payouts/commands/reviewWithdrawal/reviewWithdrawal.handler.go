package reviewwithdrawal

import (
	"context"
	"database/sql"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.WithdrawalDto, bool, error) {
	application := handler.Application
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.WithdrawalDto]{
		Scope: "staff:" + command.StaffId + ":withdrawals.review", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.WithdrawalId, command.Decision, command.Reason),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.WithdrawalDto, error) {
			return application.Withdrawals.ReviewWithdrawalInTransaction(ctx, transaction, command.StaffId, command.WithdrawalId, command.Decision, command.Reason)
		},
	})
}

package cancelwithdrawal

import (
	"context"
	"database/sql"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/wallet/src/modules/payouts"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.WithdrawalDto, error) {
	var cancelled dtos.WithdrawalDto
	err := databases.RunInMoneyTransaction(ctx, handler.Application.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		cancelled, err = handler.Application.Withdrawals.CancelWithdrawalInTransaction(ctx, transaction, command.UserId, command.WithdrawalId)
		return err
	})
	return cancelled, err
}

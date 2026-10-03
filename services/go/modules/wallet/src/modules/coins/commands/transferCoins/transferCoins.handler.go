package transfercoins

import (
	"context"
	"database/sql"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/coins"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CoinTransferReceiptDto, bool, error) {
	input := command.Input
	return ledgerutils.RunIdempotentMoneyCommand(ctx, handler.Application.Container.Resources.Database, handler.Application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.CoinTransferReceiptDto]{
		Scope: input.SenderUserId + ":coins.transfer", Key: input.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.RecipientUserId, input.Coins, input.Note),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.CoinTransferReceiptDto, error) {
			return handler.Application.Transfers.TransferCoinsInTransaction(ctx, transaction, input)
		},
	})
}

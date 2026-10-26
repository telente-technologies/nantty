package convertearnedcoins

import (
	"context"
	"database/sql"

	ledgerutils "nantty/modules/ledger/src/utils"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/dtos"
)

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CoinConversionReceiptDto, bool, error) {
	input := command.Input
	if err := handler.Application.Container.Payments.RequireVerificationLevel(ctx, input.UserId, paymentmodels.VerificationLevelPayout); err != nil {
		return dtos.CoinConversionReceiptDto{}, false, err
	}
	return ledgerutils.RunIdempotentMoneyCommand(ctx, handler.Application.Container.Resources.Database, handler.Application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.CoinConversionReceiptDto]{
		Scope: input.UserId + ":coins.convert", Key: input.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(input.Coins, input.Currency),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.CoinConversionReceiptDto, error) {
			return handler.Application.Balances.ConvertEarnedCoinsToCashInTransaction(ctx, transaction, input)
		},
	})
}

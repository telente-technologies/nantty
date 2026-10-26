package requestwithdrawal

import (
	"context"
	"database/sql"

	ledgerutils "nantty/modules/ledger/src/utils"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/payouts/dtos"
)

type Handler struct {
	Application *payouts.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.WithdrawalDto, bool, error) {
	application := handler.Application
	if err := application.Container.Payments.RequireSellerVerifiedForWithdrawal(ctx, command.UserId); err != nil {
		return dtos.WithdrawalDto{}, false, err
	}
	if err := application.Container.Payments.RequirePayoutAccountVerified(ctx, command.UserId); err != nil {
		return dtos.WithdrawalDto{}, false, err
	}
	if err := application.Container.Payments.RequireVerificationLevel(ctx, command.UserId, paymentmodels.VerificationLevelPayout); err != nil {
		return dtos.WithdrawalDto{}, false, err
	}
	providerAvailable, err := application.Container.Payments.ReadProviderAvailableBalanceForUser(ctx, command.UserId, command.Currency)
	if err != nil {
		return dtos.WithdrawalDto{}, false, err
	}
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.WithdrawalDto]{
		Scope: command.UserId + ":wallet.withdraw", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.PayoutAccountId, command.AmountMinor, command.Currency),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.WithdrawalDto, error) {
			level, err := application.Container.Payments.ReadVerificationLevelInTransaction(ctx, transaction, command.UserId)
			if err != nil {
				return dtos.WithdrawalDto{}, err
			}
			nameMatchedOnly := level.Method != nil && *level.Method == "payout_account"
			return application.Withdrawals.RequestWithdrawalInTransaction(ctx, transaction, command.UserId, command.PayoutAccountId, command.AmountMinor, command.Currency, providerAvailable, level.Level, nameMatchedOnly)
		},
	})
}

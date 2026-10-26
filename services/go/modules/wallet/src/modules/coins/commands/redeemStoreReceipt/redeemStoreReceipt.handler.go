package redeemstorereceipt

import (
	"context"
	"database/sql"

	ledgerutils "nantty/modules/ledger/src/utils"
	paymentconstants "nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/wallet/src/modules/coins"
	"nantty/modules/wallet/src/modules/coins/dtos"
)

var storeByPlatform = map[string]string{"ios": paymentconstants.StoreAppleIap, "android": paymentconstants.StoreGooglePlay}

type Handler struct {
	Application *coins.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.VerifiedCoinPurchaseDto, bool, error) {
	application := handler.Application
	store := storeByPlatform[command.Platform]
	verified, err := application.Container.Payments.VerifyStoreReceipt(ctx, store, interfaces.StoreReceipt{ProductId: command.ProductId, ReceiptData: command.Receipt, TransactionId: command.TransactionId})
	if err != nil {
		return dtos.VerifiedCoinPurchaseDto{}, false, err
	}
	return ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.VerifiedCoinPurchaseDto]{
		Scope: command.UserId + ":coins.storeReceipt", Key: command.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(command.Platform, command.ProductId, command.Receipt, command.TransactionId),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.VerifiedCoinPurchaseDto, error) {
			return application.Purchases.RedeemVerifiedStorePurchaseInTransaction(ctx, transaction, command.UserId, store, verified)
		},
	})
}

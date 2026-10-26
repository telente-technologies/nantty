package services

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentrefund"
)

func IsWalletPaidIntent(intent *ent.PaymentIntent) bool {
	return strings.HasPrefix(intent.ProviderTransactionID, "wallet:")
}

func (gateway *PaymentGateway) refundIntoProviderWallet(ctx context.Context, refundId uuid.UUID) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		refund, err := client.PaymentRefund.Query().Where(paymentrefund.ID(refundId)).ForUpdate().Only(ctx)
		if err != nil || refund.Status != paymentrefund.StatusProcessing {
			return err
		}
		intent, err := client.PaymentIntent.Get(ctx, refund.PaymentIntentID)
		if err != nil {
			return err
		}
		now := gateway.Container.Now().UTC()
		if err := refund.Update().SetStatus(paymentrefund.StatusSucceeded).SetCompletedAt(now).SetFailureReason("").Exec(ctx); err != nil {
			return err
		}
		if err := client.PaymentIntent.UpdateOneID(intent.ID).AddRefundInFlightMinor(-refund.AmountMinor).AddRefundedMinor(refund.AmountMinor).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		if err := gateway.CreditWalletFromPlatformInTransaction(ctx, transaction, intent.OwnerUserID, refund.Currency, "refund:"+refund.ID.String(), refund.Reference, refund.AmountMinor,
			ledgermodels.RefundsPayableAccount(refund.Provider, refund.Currency), "Refund returned to your wallet"); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.succeeded", refund.ID.String(), now, refundEventData(refund))
	})
}

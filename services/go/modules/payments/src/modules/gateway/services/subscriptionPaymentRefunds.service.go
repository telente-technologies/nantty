package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

type SubscriptionPaymentRefund struct {
	PaymentReference string
	Reference        string
	AmountMinor      int64
	Full             bool
	Reason           string
}

var ErrRefundAmountInvalid = httpserver.NewApiError(http.StatusUnprocessableEntity, "REFUND_AMOUNT_INVALID", "A refund needs an amount above zero, or an explicit full refund.")

func (gateway *PaymentGateway) RefundSubscriptionPayment(ctx context.Context, request SubscriptionPaymentRefund) (string, error) {
	if request.Reference == "" {
		return "", errors.New("a subscription refund needs an idempotency reference")
	}
	if request.Full == (request.AmountMinor != 0) || request.AmountMinor < 0 {
		return "", ErrRefundAmountInvalid
	}
	var requested RequestedRefund
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		intent, err := gateway.Container.Client(transaction).PaymentIntent.Query().Where(paymentintent.Reference(request.PaymentReference)).Only(ctx)
		if ent.IsNotFound(err) {
			return ErrPaymentNotFound
		}
		if err != nil {
			return err
		}
		amount := request.AmountMinor
		if request.Full {
			amount = intent.AmountMinor - intent.RefundedMinor
		}
		if earlier, err := gateway.Container.Client(transaction).PaymentRefund.Query().Where(paymentrefund.Reference(request.Reference)).Only(ctx); err == nil {
			if !request.Full && earlier.AmountMinor != request.AmountMinor {
				return ErrRefundAmountInvalid
			}
			amount = earlier.AmountMinor
		} else if amount <= 0 || amount > intent.AmountMinor-intent.RefundedMinor {
			return ErrRefundExceedsPayment
		}
		if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: request.Reference, Kind: "subscription.paymentRefunded", ExternalReference: intent.Reference, Description: "Plan payment returned to the subscriber",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.PlatformSubscriptionRevenueAccount(intent.Currency), Direction: ledgermodels.Debit, AmountMinor: amount},
				{Account: ledgermodels.RefundsPayableAccount(intent.Provider, intent.Currency), Direction: ledgermodels.Credit, AmountMinor: amount},
			},
		}); err != nil {
			return err
		}
		requested, err = gateway.RequestRefundInTransaction(ctx, transaction, models.RefundRequest{
			PaymentIntentId: intent.ID, AmountMinor: amount, Currency: intent.Currency, Reference: request.Reference, Reason: request.Reason,
		})
		return err
	})
	if err != nil {
		return "", err
	}
	if err := gateway.SendPendingRefundToProvider(ctx, requested.RefundId); err != nil {
		return "", err
	}
	refund, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentRefund.Get(ctx, requested.RefundId)
	if err != nil {
		return "", err
	}
	if refund.Status == paymentrefund.StatusFailed {
		return BillingChargeFailed, nil
	}
	return BillingChargeSucceeded, nil
}

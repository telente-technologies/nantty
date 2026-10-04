package services

import (
	"context"
	"database/sql"
	"errors"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/interfaces"
)

type storePartialRefunder interface {
	RefundSubscriptionPartially(ctx context.Context, purchaseToken string, amountMinor int64, currency string) error
}

type PartialBillingRefund struct {
	BillingReference string
	Reference        string
	Currency         string
	Reason           string
	AmountMinor      int64
}

// RefundBillingSubscriptionPartially returns part of a Paystack-billed charge and leaves the subscription running.
// The ledger entry is posted first under the caller's idempotency key, so a retry never records the amount twice.
func (gateway *PaymentGateway) RefundBillingSubscriptionPartially(ctx context.Context, request PartialBillingRefund) (interfaces.RefundResult, error) {
	if request.AmountMinor <= 0 || request.Reference == "" {
		return interfaces.RefundResult{}, errors.New("a partial refund needs an amount and an idempotency reference")
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: request.Reference, Kind: "verification.checkmarkShareRefunded", ExternalReference: request.BillingReference,
			Description: "Checkmark share returned after a rejected verification",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.PaymentsAwaitingApplicationAccount(request.Currency), Direction: ledgermodels.Debit, AmountMinor: request.AmountMinor},
				{Account: ledgermodels.RefundsPayableAccount(provider.Name(), request.Currency), Direction: ledgermodels.Credit, AmountMinor: request.AmountMinor},
			},
		})
		return err
	})
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	return provider.RefundCharge(ctx, interfaces.RefundRequest{
		ChargeReference: request.BillingReference, RefundReference: request.Reference, AmountMinor: request.AmountMinor,
		Currency: request.Currency, FullRefund: false, Reason: request.Reason,
	})
}

// RefundStoreSubscriptionPartially asks the store to return part of the latest payment. It reports
// ErrStoreRefundNotSupported when the store has no such call, so the caller can flag a manual refund.
func (gateway *PaymentGateway) RefundStoreSubscriptionPartially(ctx context.Context, store, purchaseToken string, amountMinor int64, currency string) error {
	if store != constants.StoreGooglePlay {
		return ErrStoreRefundNotSupported
	}
	verifier, err := gateway.Container.StoreVerifier(store)
	if err != nil {
		return err
	}
	refunder, supported := verifier.(storePartialRefunder)
	if !supported {
		return ErrStoreRefundNotSupported
	}
	return refunder.RefundSubscriptionPartially(ctx, purchaseToken, amountMinor, currency)
}

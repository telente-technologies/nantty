package services

import (
	"context"
	"database/sql"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/predicate"
	"nantty/modules/payments/src/interfaces"
)

func findDisputedIntent(ctx context.Context, client *ent.Client, provider string, dispute interfaces.ProviderDispute) (*ent.PaymentIntent, error) {
	var matches []predicate.PaymentIntent
	if dispute.ProviderChargeId != "" {
		matches = append(matches, paymentintent.ProviderTransactionID(dispute.ProviderChargeId))
	}
	if dispute.ChargeReference != "" {
		matches = append(matches, paymentintent.Reference(dispute.ChargeReference))
	}
	if len(matches) == 0 {
		return nil, nil
	}
	intent, err := client.PaymentIntent.Query().Where(paymentintent.Provider(provider), paymentintent.Or(matches...)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return intent, err
}

func disputedAmount(intent *ent.PaymentIntent, dispute interfaces.ProviderDispute) int64 {
	if dispute.AmountMinor <= 0 || dispute.AmountMinor > intent.AmountMinor {
		return intent.AmountMinor
	}
	return dispute.AmountMinor
}

func (gateway *PaymentGateway) postChargebackWithholdingInTransaction(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent, dispute interfaces.ProviderDispute, opened bool) error {
	if intent.Provider != constants.ProviderFlutterwave {
		return nil
	}
	amount := disputedAmount(intent, dispute)
	receivable := ledgermodels.PlatformChargebackReceivableAccount(intent.Provider, intent.Currency)
	balance := ledgermodels.PlatformProviderBalanceAccount(intent.Provider, intent.Currency)
	withheld := "chargeback-withheld:" + dispute.ProviderDisputeId
	if _, found, err := gateway.Container.Ledger.FindJournalEntryByReference(ctx, transaction, withheld); err != nil || (!found && dispute.Status == "won") {
		return err
	} else if !found {
		if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: withheld, Kind: "chargeback.withheld", ExternalReference: intent.Reference, Description: "Provider withheld a disputed card payment",
			Lines: moveLines(receivable, balance, amount),
		}); err != nil {
			return err
		}
		gateway.RecordPaymentAlertMetric(ctx, "chargebackOpened", "paymentReference", intent.Reference, "amountMinor", amount)
	}
	if dispute.Status != "won" {
		return nil
	}
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "chargeback-returned:" + dispute.ProviderDisputeId, Kind: "chargeback.returned", ExternalReference: intent.Reference,
		Description: "Chargeback won; the provider returned the withheld amount", Lines: moveLines(balance, receivable, amount),
	})
	return err
}

func (gateway *PaymentGateway) writeOffUnrecoverableChargebackInTransaction(ctx context.Context, transaction *sql.Tx, intent *ent.PaymentIntent, dispute interfaces.ProviderDispute) error {
	if intent.Provider != constants.ProviderFlutterwave || dispute.Status != "lost" {
		return nil
	}
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "chargeback-lost:" + dispute.ProviderDisputeId, Kind: "chargeback.lostUnrecovered", ExternalReference: intent.Reference,
		Description: "Chargeback lost on a payment with no recovery path",
		Lines:       moveLines(ledgermodels.PlatformUnreconciledLossAccount(intent.Currency), ledgermodels.PlatformChargebackReceivableAccount(intent.Provider, intent.Currency), disputedAmount(intent, dispute)),
	})
	return err
}

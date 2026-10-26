package services

import (
	"context"
	"database/sql"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent/paymentintent"
)

func (gateway *PaymentGateway) ProcessProviderSettlements(ctx context.Context, report *WalletReconciliationReport) int {
	if gateway.Container.Settings.DefaultProvider != constants.ProviderFlutterwave {
		return 0
	}
	payouts, err := gateway.Container.DefaultPayouts()
	if err != nil {
		return 0
	}
	now := gateway.Container.Now().UTC()
	settlements, err := payouts.ListSettlements(ctx, "", now.AddDate(0, 0, -7), now.AddDate(0, 0, 1))
	if err != nil {
		if report != nil {
			report.Issues = append(report.Issues, "could not list settlements")
		}
		return 0
	}
	applied := 0
	for _, settlement := range settlements {
		if settlement.Status != "success" {
			continue
		}
		references, err := payouts.ListSettlementChargeReferences(ctx, settlement.ProviderSettlementId)
		if err != nil {
			continue
		}
		for _, reference := range references {
			settled, err := gateway.markIntentSettled(ctx, reference, settlement.ProviderSettlementId)
			if err != nil {
				gateway.Container.Resources.Logger.WarnContext(ctx, "could not apply a settlement line", "reference", reference, "error", err)
			}
			if settled {
				applied++
			}
		}
	}
	return applied
}

func (gateway *PaymentGateway) markIntentSettled(ctx context.Context, reference, settlementId string) (bool, error) {
	settled := false
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		settled = false
		client := gateway.Container.Client(transaction)
		intent, err := client.PaymentIntent.Query().Where(paymentintent.Reference(reference), paymentintent.Provider(constants.ProviderFlutterwave)).ForUpdate().Only(ctx)
		if err != nil || intent.Status != paymentintent.StatusSucceeded || intent.ProviderSettledAt != nil {
			return nil
		}
		net := intent.AmountMinor - intent.ProviderFeeMinor
		if net > 0 {
			if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
				Reference: "settled:" + intent.Reference, Kind: "payment.settled", ExternalReference: intent.Reference, Description: "Provider settled the payment into the main balance",
				Metadata: map[string]any{"settlementId": settlementId},
				Lines: []ledgermodels.JournalLineRequest{
					{Account: ledgermodels.PlatformProviderBalanceAccount(intent.Provider, intent.Currency), Direction: ledgermodels.Debit, AmountMinor: net},
					{Account: ledgermodels.PlatformProviderPendingAccount(intent.Provider, intent.Currency), Direction: ledgermodels.Credit, AmountMinor: net},
				},
			}); err != nil {
				return err
			}
		}
		settled = true
		return intent.Update().SetProviderSettledAt(gateway.Container.Now().UTC()).AddVersion(1).Exec(ctx)
	})
	return settled, err
}

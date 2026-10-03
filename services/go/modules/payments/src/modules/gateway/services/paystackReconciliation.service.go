package services

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccount"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
)

type ProviderMirrorReport struct {
	AccountsChecked        int            `json:"accountsChecked"`
	PendingIntentsVerified int            `json:"pendingIntentsVerified"`
	TransfersConfirmed     int            `json:"transfersConfirmed"`
	DirectChargesSettled   int            `json:"directChargesSettled"`
	BalanceBreaks          []BalanceBreak `json:"balanceBreaks"`
	Failures               int            `json:"failures"`
}

type BalanceBreak struct {
	Currency      string `json:"currency"`
	ProviderMinor int64  `json:"providerMinor"`
	LedgerMinor   int64  `json:"ledgerMinor"`
}

func (gateway *PaymentGateway) ReconcileProviderHeldSellerFundsAgainstProviderBalances(ctx context.Context) (int, error) {
	report, err := gateway.ReconcileProviderMirror(ctx)
	return len(report.BalanceBreaks) + report.Failures, err
}

func (gateway *PaymentGateway) ReconcileProviderMirror(ctx context.Context) (ProviderMirrorReport, error) {
	report := ProviderMirrorReport{BalanceBreaks: []BalanceBreak{}}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return report, err
	}
	database := gateway.Container.Resources.Database
	client := gateway.Container.Client(database)
	now := gateway.Container.Now().UTC()
	pending, err := client.PaymentIntent.Query().Where(paymentintent.StatusEQ(paymentintent.StatusPending), paymentintent.ProviderCheckoutIDNEQ(""), paymentintent.CreatedAtLT(now.Add(-15*time.Minute)), paymentintent.CreatedAtGT(now.Add(-72*time.Hour))).Limit(200).All(ctx)
	if err != nil {
		return report, err
	}
	for _, intent := range pending {
		if _, err := gateway.VerifyAndSettlePaymentIntentByReference(ctx, intent.Reference); err == nil {
			report.PendingIntentsVerified++
		} else {
			report.Failures++
		}
	}
	processing, err := client.PayoutTransfer.Query().Where(payouttransfer.StatusEQ(payouttransfer.StatusProcessing), payouttransfer.CreatedAtLT(now.Add(-10*time.Minute))).Limit(200).All(ctx)
	if err != nil {
		return report, err
	}
	for _, transfer := range processing {
		if _, err := gateway.FinalizeTransferByReferenceWithProvider(ctx, transfer.Reference); err == nil {
			report.TransfersConfirmed++
		} else {
			report.Failures++
		}
	}
	balances, err := provider.ReadPlatformBalances(ctx)
	if err != nil {
		return report, convertProviderError(err)
	}
	for _, balance := range balances {
		ledgerBalance, err := gateway.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.PlatformProviderBalanceAccount(provider.Name(), balance.Currency))
		if err != nil {
			return report, err
		}
		if ledgerBalance != balance.AvailableMinor {
			report.BalanceBreaks = append(report.BalanceBreaks, BalanceBreak{Currency: balance.Currency, ProviderMinor: balance.AvailableMinor, LedgerMinor: ledgerBalance})
		}
	}
	sellers, err := client.ConnectedAccount.Query().Where(connectedaccount.SettlementSubaccountCodeNEQ("")).All(ctx)
	if err != nil {
		return report, err
	}
	var failures []error
	for _, seller := range sellers {
		report.AccountsChecked++
		settled, err := gateway.settleDirectChargesForSubaccount(ctx, seller, now.Add(-7*24*time.Hour), now)
		report.DirectChargesSettled += settled
		if err != nil {
			failures = append(failures, err)
			report.Failures++
		}
	}
	if len(report.BalanceBreaks) > 0 {
		gateway.Container.Resources.Logger.WarnContext(ctx, "paystack balance does not match the ledger", slog.Any("breaks", report.BalanceBreaks))
	}
	return report, errors.Join(failures...)
}

func (gateway *PaymentGateway) settleDirectChargesForSubaccount(ctx context.Context, seller *ent.ConnectedAccount, from, to time.Time) (int, error) {
	provider, err := gateway.Container.Provider(seller.Provider)
	if err != nil {
		return 0, err
	}
	settlements, err := provider.ListSettlements(ctx, seller.SettlementSubaccountCode, from, to)
	if err != nil {
		return 0, convertProviderError(err)
	}
	count := 0
	for _, settlement := range settlements {
		if settlement.Status != "success" {
			continue
		}
		references, err := provider.ListSettlementChargeReferences(ctx, settlement.ProviderSettlementId)
		if err != nil {
			return count, convertProviderError(err)
		}
		for _, reference := range references {
			settled, err := gateway.postDirectChargeSettled(ctx, reference, settlement.ProviderSettlementId)
			if err != nil {
				return count, err
			}
			if settled {
				count++
			}
		}
	}
	return count, nil
}

func (gateway *PaymentGateway) postDirectChargeSettled(ctx context.Context, reference, settlementId string) (bool, error) {
	intent, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentIntent.Query().Where(paymentintent.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && (!IsConnectedAccountCharge(intent) || intent.Status != paymentintent.StatusSucceeded)) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	journalReference := "direct-settled-" + intent.Reference
	if _, found, err := gateway.Container.Ledger.FindJournalEntryByReference(ctx, gateway.Container.Resources.Database, journalReference); err != nil || found {
		return false, err
	}
	amount := AppliedCollectionAmount(intent)
	return true, databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: journalReference, Kind: "directPayment.settledByPaystack", ExternalReference: settlementId, Description: "Paystack settled the direct payment to the seller's bank",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.SellerSettlingByPaystackAccount(intent.BeneficiaryUserID, intent.Currency), Direction: ledgermodels.Debit, AmountMinor: amount},
				{Account: ledgermodels.SellerProviderHeldFundsAccount(intent.BeneficiaryUserID, intent.Currency), Direction: ledgermodels.Credit, AmountMinor: amount},
			},
		})
		return err
	})
}

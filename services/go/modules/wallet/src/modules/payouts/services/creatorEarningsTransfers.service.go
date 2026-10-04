package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/wallet/src/container"
)

type CreatorEarningsTransfers struct {
	Container *container.Container
	Holds     MonetisationHolds
}

type CreatorEarningsTransferReport struct {
	Transferred int `json:"transferred"`
	Skipped     int `json:"skipped"`
	Failed      int `json:"failed"`
}

func (transfers CreatorEarningsTransfers) TransferCreatorEarningsToConnectedAccounts(ctx context.Context, runId string) CreatorEarningsTransferReport {
	report := CreatorEarningsTransferReport{}
	database := transfers.Container.Resources.Database
	for currency, minimum := range transfers.Container.Settings.CreatorTransferMinimum {
		balances, err := transfers.Container.Ledger.ListBalancesOfAccountsWithCodePrefix(ctx, database, "creator:", currency)
		if err != nil {
			transfers.Container.Resources.Logger.WarnContext(ctx, "could not list creator earnings", slog.Any("error", err))
			report.Failed++
			continue
		}
		for _, balance := range balances {
			if !strings.HasSuffix(balance.Code, ledgermodels.CreatorEarningsPayableAccountCodeSuffix()) || balance.BalanceMinor < minimum {
				continue
			}
			userId := strings.TrimSuffix(strings.TrimPrefix(balance.Code, "creator:"), ledgermodels.CreatorEarningsPayableAccountCodeSuffix())
			if paused, err := transfers.Holds.IsMonetisationPaused(ctx, database, userId); err != nil || paused {
				report.Skipped++
				continue
			}
			if transfers.Container.Payments.RequirePayoutAccountVerified(ctx, userId) != nil {
				report.Skipped++
				continue
			}
			if err := transfers.moveEarningsToWithdrawable(ctx, userId, currency, balance.BalanceMinor, fmt.Sprintf("creator-earnings-%s-%s-%s", runId, userId, currency)); err != nil {
				transfers.Container.Resources.Logger.WarnContext(ctx, "creator earnings move failed", slog.String("userId", userId), slog.Any("error", err))
				report.Failed++
				continue
			}
			report.Transferred++
		}
	}
	return report
}

func (transfers CreatorEarningsTransfers) moveEarningsToWithdrawable(ctx context.Context, userId, currency string, amountMinor int64, reference string) error {
	return databases.RunInMoneyTransaction(ctx, transfers.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if _, err := transfers.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: reference, Kind: "creatorEarnings.madeWithdrawable", Description: "Creator earnings ready to pay out",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.CreatorEarningsPayableAccount(userId, currency), Direction: ledgermodels.Debit, AmountMinor: amountMinor},
				{Account: ledgermodels.SellerAvailableAccount(userId, currency), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
			},
		}); err != nil {
			return err
		}
		return transfers.Container.Outbox.EnqueueInTransaction(ctx, transaction, "creatorEarnings.transferred", userId, transfers.Container.Now().UTC(), map[string]any{
			"userId": userId, "reference": reference, "amount": map[string]any{"amountMinor": amountMinor, "currency": currency},
		})
	})
}

func (transfers CreatorEarningsTransfers) HandleTransferSucceeded(context.Context, *sql.Tx, paymentmodels.FinishedTransfer) error {
	return nil
}

func (transfers CreatorEarningsTransfers) HandleTransferFailed(context.Context, *sql.Tx, paymentmodels.FinishedTransfer) error {
	return nil
}

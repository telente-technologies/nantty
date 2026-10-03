package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/container"
)

type CreatorEarningsTransfers struct {
	Container *container.Container
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
			status, err := transfers.Container.Payments.TransferPlatformFundsToConnectedAccount(ctx, paymentmodels.PlatformTransferInstruction{
				Purpose: paymentconstants.PurposeCreatorEarnings, SubjectId: userId, BeneficiaryUserId: userId,
				Reference: fmt.Sprintf("creator-earnings:%s:%s:%s", runId, userId, currency), AmountMinor: balance.BalanceMinor, Currency: currency,
				TransferGroup: "creator-run:" + runId, Description: "Creator earnings",
			})
			switch {
			case errors.Is(err, paymentservices.ErrConnectedAccountMissing):
				report.Skipped++
			case err != nil:
				transfers.Container.Resources.Logger.WarnContext(ctx, "creator earnings transfer failed", slog.String("userId", userId), slog.Any("error", err))
				report.Failed++
			case status.Status == "succeeded":
				report.Transferred++
			}
		}
	}
	return report
}

func (transfers CreatorEarningsTransfers) HandleTransferSucceeded(ctx context.Context, transaction *sql.Tx, transfer paymentmodels.FinishedTransfer) error {
	userId := transfer.BeneficiaryUserId
	_, err := transfers.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "creator-earnings-transferred:" + transfer.Reference, Kind: "creatorEarnings.transferred", ExternalReference: transfer.Reference,
		Description: "Creator earnings moved to the creator's provider account",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.CreatorEarningsPayableAccount(userId, transfer.Currency), Direction: ledgermodels.Debit, AmountMinor: transfer.AmountMinor},
			{Account: ledgermodels.PlatformProviderBalanceAccount(transfer.Provider, transfer.Currency), Direction: ledgermodels.Credit, AmountMinor: transfer.AmountMinor},
			{Account: ledgermodels.SellerProviderHeldFundsAccount(userId, transfer.Currency), Direction: ledgermodels.Debit, AmountMinor: transfer.AmountMinor},
			{Account: ledgermodels.SellerAvailableAccount(userId, transfer.Currency), Direction: ledgermodels.Credit, AmountMinor: transfer.AmountMinor},
		},
	})
	if err != nil {
		return err
	}
	return transfers.Container.Outbox.EnqueueInTransaction(ctx, transaction, "creatorEarnings.transferred", userId, transfer.FinishedAt, map[string]any{
		"userId": userId, "reference": transfer.Reference, "amount": map[string]any{"amountMinor": transfer.AmountMinor, "currency": transfer.Currency},
	})
}

func (transfers CreatorEarningsTransfers) HandleTransferFailed(context.Context, *sql.Tx, paymentmodels.FinishedTransfer) error {
	return nil
}

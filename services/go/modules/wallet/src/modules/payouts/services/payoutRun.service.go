package services

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/withdrawal"
	"zudomart/modules/wallet/src/interfaces"
)

type PayoutRunReport struct {
	Started    int `json:"started"`
	Paid       int `json:"paid"`
	Failed     int `json:"failed"`
	Processing int `json:"processing"`
	Errors     int `json:"errors"`
}

func (withdrawals Withdrawals) RunPayoutBatch(ctx context.Context, maximum int) PayoutRunReport {
	report := PayoutRunReport{}
	for report.Started < maximum {
		claimed, err := withdrawals.claimNextQueuedWithdrawal(ctx)
		if err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "payout run could not claim a withdrawal", slog.Any("error", err))
			report.Errors++
			return report
		}
		if claimed == nil {
			return report
		}
		report.Started++
		status, err := withdrawals.sendWithdrawalToProvider(ctx, claimed)
		if err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "payout transfer could not be started", slog.String("withdrawalId", claimed.ID.String()), slog.Any("error", err))
			report.Errors++
			continue
		}
		switch status {
		case "succeeded":
			report.Paid++
		case "failed":
			report.Failed++
		default:
			report.Processing++
		}
	}
	return report
}

func (withdrawals Withdrawals) claimNextQueuedWithdrawal(ctx context.Context) (*ent.Withdrawal, error) {
	var claimed *ent.Withdrawal
	err := databases.RunInMoneyTransaction(ctx, withdrawals.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		claimed = nil
		next, err := withdrawals.Container.Client(transaction).Withdrawal.Query().Where(withdrawal.StatusEQ(withdrawal.StatusQueued)).
			Order(ent.Asc(withdrawal.FieldCreatedAt)).Limit(1).ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		claimed, err = next.Update().AddVersion(1).SetStatus(withdrawal.StatusProcessing).Save(ctx)
		return err
	})
	return claimed, err
}

func (withdrawals Withdrawals) sendWithdrawalToProvider(ctx context.Context, claimed *ent.Withdrawal) (string, error) {
	account, err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).PayoutAccount.Get(ctx, claimed.PayoutAccountID)
	if err != nil {
		return "", err
	}
	accountNumber, err := withdrawals.Container.Encryptor.Decrypt(account.AccountNumberCiphertext, account.ID.String())
	if err != nil {
		return "", err
	}
	return withdrawals.Container.Settlement.SettleSellerPayout(ctx, interfaces.SellerPayoutInstruction{
		WithdrawalId: claimed.ID.String(), Reference: claimed.Reference, Provider: claimed.Provider, AmountMinor: claimed.NetMinor,
		Currency: claimed.Currency, BankCode: account.BankCode, AccountNumber: accountNumber, AccountName: account.AccountName,
	})
}

func (withdrawals Withdrawals) HandleTransferSucceeded(ctx context.Context, transaction *sql.Tx, transfer paymentmodels.FinishedTransfer) error {
	locked, err := withdrawals.lockWithdrawal(ctx, transaction, uuid.MustParse(transfer.SubjectId))
	if err != nil || locked.Status != withdrawal.StatusProcessing {
		return err
	}
	paid, err := locked.Update().AddVersion(1).SetStatus(withdrawal.StatusPaid).SetProcessedAt(transfer.FinishedAt).Save(ctx)
	if err != nil {
		return err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.SellerReservedPayoutAccount(locked.UserID, locked.Currency), Direction: ledgermodels.Debit, AmountMinor: locked.AmountMinor},
		{Account: ledgermodels.ProviderClearingAccount(locked.Provider, locked.Currency), Direction: ledgermodels.Credit, AmountMinor: locked.NetMinor},
	}
	if locked.FeeMinor > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.ProviderClearingAccount(locked.Provider, locked.Currency), Direction: ledgermodels.Credit, AmountMinor: locked.FeeMinor})
	}
	if _, err := withdrawals.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "withdrawal-paid:" + locked.ID.String(), Kind: "withdrawal.paid", ExternalReference: locked.Reference,
		Description: locked.DestinationLabel, Metadata: map[string]any{"withdrawalId": locked.ID.String(), "feeMinor": locked.FeeMinor}, Lines: lines,
	}); err != nil {
		return err
	}
	return withdrawals.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payout.completed", locked.ID.String(), transfer.FinishedAt, withdrawalEventData(paid))
}

func (withdrawals Withdrawals) HandleTransferFailed(ctx context.Context, transaction *sql.Tx, transfer paymentmodels.FinishedTransfer) error {
	locked, err := withdrawals.lockWithdrawal(ctx, transaction, uuid.MustParse(transfer.SubjectId))
	if err != nil || locked.Status != withdrawal.StatusProcessing {
		return err
	}
	if _, err := withdrawals.reverseWithdrawalInTransaction(ctx, transaction, locked, withdrawal.StatusFailed, "transfer failed: "+transfer.FailureReason, ""); err != nil {
		return err
	}
	return withdrawals.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payout.failed", locked.ID.String(), transfer.FinishedAt, withdrawalEventData(locked))
}

func (withdrawals Withdrawals) FinalizeProcessingWithdrawalsOlderThan(ctx context.Context, age time.Duration) {
	rows, err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).Withdrawal.Query().
		Where(withdrawal.StatusEQ(withdrawal.StatusProcessing), withdrawal.UpdatedAtLT(withdrawals.Container.Now().Add(-age))).Limit(200).All(ctx)
	if err != nil {
		withdrawals.Container.Resources.Logger.WarnContext(ctx, "could not list processing withdrawals", slog.Any("error", err))
		return
	}
	for _, row := range rows {
		if _, err := withdrawals.Container.Payments.FinalizeTransferByReferenceWithProvider(ctx, row.Reference); err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "could not confirm a payout with the provider", slog.String("withdrawalId", row.ID.String()), slog.Any("error", err))
		}
	}
}

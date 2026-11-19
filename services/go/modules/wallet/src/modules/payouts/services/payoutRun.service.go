package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentinterfaces "nantty/modules/payments/src/interfaces"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/payoutaccount"
	"nantty/modules/wallet/src/generated/ent/withdrawal"
	"nantty/modules/wallet/src/interfaces"
)

type PayoutRunReport struct {
	Started          int `json:"started"`
	Paid             int `json:"paid"`
	Failed           int `json:"failed"`
	Processing       int `json:"processing"`
	Errors           int `json:"errors"`
	CreatorTransfers int `json:"creatorTransfers"`
}

func (withdrawals Withdrawals) RunPayoutBatch(ctx context.Context, maximum int) PayoutRunReport {
	report := PayoutRunReport{}
	var skipped []uuid.UUID
	for report.Started < maximum {
		candidate, err := withdrawals.nextQueuedWithdrawalCandidate(ctx, skipped)
		if err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "payout run could not find a queued withdrawal", slog.Any("error", err))
			report.Errors++
			return report
		}
		if candidate == nil {
			return report
		}
		if err := withdrawals.validatePayoutBranch(ctx, candidate); err != nil {
			skipped = append(skipped, candidate.ID)
			withdrawals.noteWithdrawalNotSent(ctx, candidate, err.Error())
			report.Errors++
			continue
		}
		claimed, prepared, err := withdrawals.claimQueuedWithdrawal(ctx, candidate.ID)
		if claimed != nil && errors.Is(err, interfaces.ErrPayoutNotSentRetryLater) {
			skipped = append(skipped, claimed.ID)
			withdrawals.noteWithdrawalNotSent(ctx, claimed, err.Error())
			report.Errors++
			continue
		}
		if err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "payout run could not claim a withdrawal", slog.Any("error", err))
			report.Errors++
			if claimed == nil {
				return report
			}
			skipped = append(skipped, claimed.ID)
			continue
		}
		if claimed == nil {
			return report
		}
		report.Started++
		status, err := withdrawals.sendClaimedWithdrawal(ctx, claimed, prepared)
		if errors.Is(err, interfaces.ErrPayoutNotSentRetryLater) {
			withdrawals.returnWithdrawalToQueue(ctx, claimed, err.Error())
			skipped = append(skipped, claimed.ID)
			report.Errors++
			continue
		}
		if err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "payout transfer could not be started; the reconciler resolves it", slog.String("withdrawalId", claimed.ID.String()), slog.Any("error", err))
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

func (withdrawals Withdrawals) nextQueuedWithdrawalCandidate(ctx context.Context, skipped []uuid.UUID) (*ent.Withdrawal, error) {
	candidate, err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).Withdrawal.Query().
		Where(withdrawal.StatusEQ(withdrawal.StatusQueued), withdrawal.IDNotIn(skipped...)).
		Order(ent.Asc(withdrawal.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return candidate, err
}

func (withdrawals Withdrawals) validatePayoutBranch(ctx context.Context, candidate *ent.Withdrawal) error {
	if withdrawals.Banks == nil {
		return nil
	}
	account, err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).PayoutAccount.Query().
		Where(payoutaccount.ID(candidate.PayoutAccountID), payoutaccount.DeletedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return fmt.Errorf("%w: the saved payout account has been removed; cancel this withdrawal or contact support", interfaces.ErrPayoutNotSentRetryLater)
	}
	if err != nil {
		return err
	}
	branches, err := withdrawals.Banks.ListBankBranches(ctx, account.CountryCode, account.BankCode)
	if errors.Is(err, paymentinterfaces.ErrCapabilityNotSupported) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("%w: bank branch information could not be refreshed; the payout was not sent", interfaces.ErrPayoutNotSentRetryLater)
	}
	if len(branches) == 0 {
		if account.BranchCode != "" {
			return fmt.Errorf("%w: the saved bank branch is no longer available; contact support to update this payout before retrying", interfaces.ErrPayoutNotSentRetryLater)
		}
		return nil
	}
	for _, branch := range branches {
		if branch.Code == account.BranchCode && account.BranchCode != "" {
			return nil
		}
	}
	return fmt.Errorf("%w: this payout account needs a current bank branch; contact support before retrying", interfaces.ErrPayoutNotSentRetryLater)
}

func (withdrawals Withdrawals) claimQueuedWithdrawal(ctx context.Context, candidateID uuid.UUID) (*ent.Withdrawal, bool, error) {
	var claimed, candidate *ent.Withdrawal
	prepared := false
	err := databases.RunInMoneyTransaction(ctx, withdrawals.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		claimed, candidate, prepared = nil, nil, false
		next, err := withdrawals.Container.Client(transaction).Withdrawal.Query().Where(withdrawal.ID(candidateID), withdrawal.StatusEQ(withdrawal.StatusQueued)).
			ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).First(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		candidate = next
		if adapter, transactional := withdrawals.Container.Settlement.(interfaces.TransactionalSettlementAdapter); transactional {
			instruction, err := withdrawals.payoutInstruction(ctx, transaction, next)
			if err != nil {
				return err
			}
			if err := adapter.PrepareSellerPayoutInTransaction(ctx, transaction, instruction); err != nil {
				return err
			}
			prepared = true
		}
		claimed, err = next.Update().AddVersion(1).SetStatus(withdrawal.StatusProcessing).Save(ctx)
		return err
	})
	if err != nil {
		return candidate, false, err
	}
	return claimed, prepared, nil
}

func (withdrawals Withdrawals) payoutInstruction(ctx context.Context, executor databases.ExecutorQuerier, claimed *ent.Withdrawal) (interfaces.SellerPayoutInstruction, error) {
	account, err := withdrawals.Container.Client(executor).PayoutAccount.Get(ctx, claimed.PayoutAccountID)
	if err != nil {
		return interfaces.SellerPayoutInstruction{}, err
	}
	accountNumber, err := withdrawals.Container.Encryptor.Decrypt(account.AccountNumberCiphertext, account.ID.String())
	if err != nil {
		return interfaces.SellerPayoutInstruction{}, err
	}
	return interfaces.SellerPayoutInstruction{
		WithdrawalId: claimed.ID.String(), UserId: claimed.UserID, Reference: claimed.Reference, AmountMinor: claimed.NetMinor, FeeMinor: claimed.FeeMinor,
		Currency: claimed.Currency, BankCode: account.BankCode, BranchCode: account.BranchCode, AccountNumber: accountNumber,
	}, nil
}

func (withdrawals Withdrawals) sendClaimedWithdrawal(ctx context.Context, claimed *ent.Withdrawal, prepared bool) (string, error) {
	if adapter, transactional := withdrawals.Container.Settlement.(interfaces.TransactionalSettlementAdapter); transactional && prepared {
		return adapter.SendPreparedSellerPayout(ctx, claimed.Reference)
	}
	instruction, err := withdrawals.payoutInstruction(ctx, withdrawals.Container.Resources.Database, claimed)
	if err != nil {
		return "", err
	}
	return withdrawals.Container.Settlement.SettleSellerPayout(ctx, instruction)
}

func (withdrawals Withdrawals) noteWithdrawalNotSent(ctx context.Context, queued *ent.Withdrawal, reason string) {
	err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).Withdrawal.Update().
		Where(withdrawal.ID(queued.ID), withdrawal.StatusEQ(withdrawal.StatusQueued)).SetFailureReason(truncate(reason, 300)).Exec(ctx)
	if err != nil {
		withdrawals.Container.Resources.Logger.WarnContext(ctx, "could not note why a withdrawal was not sent", slog.String("withdrawalId", queued.ID.String()), slog.Any("error", err))
	}
}

func (withdrawals Withdrawals) returnWithdrawalToQueue(ctx context.Context, claimed *ent.Withdrawal, reason string) {
	err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).Withdrawal.Update().
		Where(withdrawal.ID(claimed.ID), withdrawal.StatusEQ(withdrawal.StatusProcessing)).
		SetStatus(withdrawal.StatusQueued).SetFailureReason(truncate(reason, 300)).AddVersion(1).Exec(ctx)
	if err != nil {
		withdrawals.Container.Resources.Logger.WarnContext(ctx, "could not return a withdrawal to the queue", slog.String("withdrawalId", claimed.ID.String()), slog.Any("error", err))
	}
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
	source, err := withdrawals.payoutSourceAccount(ctx, transaction, locked, transfer.Provider)
	if err != nil {
		return err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.UserCashAccountsForProvider(locked.Provider, locked.UserID, locked.Currency).ReservedPayout, Direction: ledgermodels.Debit, AmountMinor: locked.AmountMinor},
		{Account: source, Direction: ledgermodels.Credit, AmountMinor: locked.AmountMinor},
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
		status, err := withdrawals.Container.Payments.FinalizeTransferByReferenceWithProvider(ctx, row.Reference)
		if err != nil {
			withdrawals.Container.Resources.Logger.WarnContext(ctx, "could not confirm a payout with the provider", slog.String("withdrawalId", row.ID.String()), slog.Any("error", err))
			continue
		}
		if status.Status == interfaces.PayoutTransferMissing {
			withdrawals.returnWithdrawalToQueue(ctx, row, "no payout transfer was created; queued again")
		}
	}
}

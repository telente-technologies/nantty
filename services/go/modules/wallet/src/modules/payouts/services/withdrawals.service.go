package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/payoutaccount"
	"zudomart/modules/wallet/src/generated/ent/withdrawal"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
	"zudomart/platform/httpserver"
)

var (
	ErrWithdrawalNotFound       = httpserver.NewApiError(http.StatusNotFound, "WITHDRAWAL_NOT_FOUND", "Withdrawal was not found.")
	ErrInsufficientFunds        = httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_FUNDS", "Amount is more than your available balance.")
	ErrWithdrawalTooSmall       = httpserver.NewApiError(http.StatusUnprocessableEntity, "WITHDRAWAL_TOO_SMALL", "This withdrawal is too small to cover the bank transfer fee.")
	ErrWithdrawalNotChangeable  = httpserver.NewApiError(http.StatusConflict, "WITHDRAWAL_NOT_CHANGEABLE", "This withdrawal can no longer be changed.")
	ErrWithdrawalCurrency       = httpserver.NewApiError(http.StatusUnprocessableEntity, "WITHDRAWAL_CURRENCY_NOT_SUPPORTED", "Withdrawals in this currency are not supported yet.")
	cancellableWithdrawalStatus = []withdrawal.Status{withdrawal.StatusPendingReview, withdrawal.StatusQueued}
)

type Withdrawals struct {
	Container *container.Container
}

func (withdrawals Withdrawals) QuoteWithdrawal(ctx context.Context, userId string, accountId uuid.UUID, amountMinor int64, currency string) (dtos.WithdrawalQuoteDto, *ent.PayoutAccount, error) {
	account, err := withdrawals.Container.Client(withdrawals.Container.Resources.Database).PayoutAccount.Query().
		Where(payoutaccount.ID(accountId), payoutaccount.UserID(userId), payoutaccount.DeletedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.WithdrawalQuoteDto{}, nil, ErrPayoutAccountNotFound
	}
	if err != nil {
		return dtos.WithdrawalQuoteDto{}, nil, err
	}
	fee, err := withdrawals.Container.Payments.QuotePayoutFee(currency, amountMinor)
	if err != nil {
		return dtos.WithdrawalQuoteDto{}, nil, ErrWithdrawalCurrency
	}
	if amountMinor < withdrawals.Container.Settings.MinimumWithdrawalMinor || fee >= amountMinor {
		return dtos.WithdrawalQuoteDto{}, nil, ErrWithdrawalTooSmall
	}
	return dtos.WithdrawalQuoteDto{
		Amount: dtos.MoneyDto{AmountMinor: amountMinor, Currency: currency}, Fee: dtos.MoneyDto{AmountMinor: fee, Currency: currency},
		NetAmount: dtos.MoneyDto{AmountMinor: amountMinor - fee, Currency: currency}, PayoutAccountId: accountId.String(),
	}, account, nil
}

func (withdrawals Withdrawals) RequestWithdrawalInTransaction(ctx context.Context, transaction *sql.Tx, userId string, accountId uuid.UUID, amountMinor int64, currency string, providerAvailableMinor int64, level int) (dtos.WithdrawalDto, error) {
	quote, account, err := withdrawals.QuoteWithdrawal(ctx, userId, accountId, amountMinor, currency)
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	if err := withdrawals.LockUserForWithdrawal(ctx, transaction, userId); err != nil {
		return dtos.WithdrawalDto{}, err
	}
	if err := withdrawals.LockUserCashForWithdrawal(ctx, transaction, userId, currency); err != nil {
		return dtos.WithdrawalDto{}, err
	}
	if err := withdrawals.enforceWithdrawalLimits(ctx, transaction, userId, account, amountMinor, currency, level); err != nil {
		return dtos.WithdrawalDto{}, err
	}
	alreadyReserved, err := withdrawals.sumWithdrawalsNotYetSentToProvider(ctx, transaction, userId, currency)
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	if !withdrawalFitsAvailableBalance(providerAvailableMinor, alreadyReserved, amountMinor) {
		return dtos.WithdrawalDto{}, ErrInsufficientFunds
	}
	status := withdrawal.StatusQueued
	if withdrawals.Container.Settings.WithdrawalsRequireReview {
		status = withdrawal.StatusPendingReview
	}
	identifier := uuid.Must(uuid.NewV7())
	created, err := withdrawals.Container.Client(transaction).Withdrawal.Create().SetID(identifier).SetUserID(userId).SetPayoutAccountID(account.ID).
		SetReference("zmwd_" + identifier.String()[:8] + identifier.String()[24:]).SetAmountMinor(amountMinor).SetFeeMinor(quote.Fee.AmountMinor).
		SetNetMinor(quote.NetAmount.AmountMinor).SetCurrency(currency).SetProvider(withdrawals.Container.Payments.Container.Settings.DefaultProvider).
		SetDestinationLabel(fmt.Sprintf("Withdrawal to %s ••••%s", account.BankName, account.AccountNumberLast4)).SetStatus(status).
		SetCreatedAt(withdrawals.Container.Now().UTC()).Save(ctx)
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	cash := ledgermodels.UserCashAccountsForProvider(created.Provider, userId, currency)
	if err := withdrawals.requireProviderWalletPayoutAllowed(ctx, transaction, userId, currency, account); err != nil {
		return dtos.WithdrawalDto{}, err
	}
	_, err = withdrawals.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "withdrawal-requested:" + created.ID.String(), Kind: "withdrawal.requested", Description: created.DestinationLabel,
		Metadata: map[string]any{"withdrawalId": created.ID.String()},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: cash.Available, Direction: ledgermodels.Debit, AmountMinor: amountMinor},
			{Account: cash.ReservedPayout, Direction: ledgermodels.Credit, AmountMinor: amountMinor},
		},
	})
	if errors.Is(err, ledgermodels.ErrInsufficientBalance) {
		return dtos.WithdrawalDto{}, ErrInsufficientFunds
	}
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	return ConvertWithdrawal(created), withdrawals.Container.Outbox.EnqueueInTransaction(ctx, transaction, "withdrawal.requested", created.ID.String(), created.CreatedAt, withdrawalEventData(created))
}

func withdrawalFitsAvailableBalance(providerAvailableMinor, alreadyReserved, amountMinor int64) bool {
	return providerAvailableMinor >= 0 && alreadyReserved >= 0 && amountMinor > 0 &&
		alreadyReserved <= providerAvailableMinor && amountMinor <= providerAvailableMinor-alreadyReserved
}

func (withdrawals Withdrawals) CancelWithdrawalInTransaction(ctx context.Context, transaction *sql.Tx, userId string, withdrawalId uuid.UUID) (dtos.WithdrawalDto, error) {
	locked, err := withdrawals.lockWithdrawal(ctx, transaction, withdrawalId)
	if err != nil || locked.UserID != userId {
		return dtos.WithdrawalDto{}, ErrWithdrawalNotFound
	}
	if locked.Status == withdrawal.StatusCancelled {
		return ConvertWithdrawal(locked), nil
	}
	if !slices.Contains(cancellableWithdrawalStatus, locked.Status) {
		return dtos.WithdrawalDto{}, ErrWithdrawalNotChangeable
	}
	return withdrawals.reverseWithdrawalInTransaction(ctx, transaction, locked, withdrawal.StatusCancelled, "cancelled by the requester", "")
}

func (withdrawals Withdrawals) ReviewWithdrawalInTransaction(ctx context.Context, transaction *sql.Tx, staffId string, withdrawalId uuid.UUID, decision, reason string) (dtos.WithdrawalDto, error) {
	locked, err := withdrawals.lockWithdrawal(ctx, transaction, withdrawalId)
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	allowed := []withdrawal.Status{withdrawal.StatusPendingReview, withdrawal.StatusOnHold}
	if decision == "hold" {
		allowed = []withdrawal.Status{withdrawal.StatusPendingReview, withdrawal.StatusQueued}
	}
	if !slices.Contains(allowed, locked.Status) {
		return dtos.WithdrawalDto{}, ErrWithdrawalNotChangeable
	}
	if decision == "reject" {
		return withdrawals.reverseWithdrawalInTransaction(ctx, transaction, locked, withdrawal.StatusFailed, "rejected: "+reason, staffId)
	}
	now := withdrawals.Container.Now().UTC()
	status, event := withdrawal.StatusQueued, "withdrawal.approved"
	if decision == "hold" {
		status, event = withdrawal.StatusOnHold, "withdrawal.held"
	}
	reviewed, err := locked.Update().AddVersion(1).SetStatus(status).SetReviewedByStaffID(staffId).SetReviewedAt(now).SetReviewNote(truncate(reason, 1000)).Save(ctx)
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	return ConvertWithdrawal(reviewed), withdrawals.Container.Outbox.EnqueueInTransaction(ctx, transaction, event, reviewed.ID.String(), now, withdrawalEventData(reviewed))
}

func (withdrawals Withdrawals) reverseWithdrawalInTransaction(ctx context.Context, transaction *sql.Tx, locked *ent.Withdrawal, status withdrawal.Status, reason, staffId string) (dtos.WithdrawalDto, error) {
	now := withdrawals.Container.Now().UTC()
	update := locked.Update().AddVersion(1).SetStatus(status).SetFailureReason(truncate(reason, 300)).SetProcessedAt(now)
	if staffId != "" {
		update.SetReviewedByStaffID(staffId).SetReviewedAt(now)
	}
	reversed, err := update.Save(ctx)
	if err != nil {
		return dtos.WithdrawalDto{}, err
	}
	if _, err := withdrawals.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "withdrawal-reversed:" + locked.ID.String(), Kind: "withdrawal.reversed", Description: "Withdrawal returned to your balance",
		Metadata: map[string]any{"withdrawalId": locked.ID.String(), "reason": reason},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.UserCashAccountsForProvider(locked.Provider, locked.UserID, locked.Currency).ReservedPayout, Direction: ledgermodels.Debit, AmountMinor: locked.AmountMinor},
			{Account: ledgermodels.UserCashAccountsForProvider(locked.Provider, locked.UserID, locked.Currency).Available, Direction: ledgermodels.Credit, AmountMinor: locked.AmountMinor},
		},
	}); err != nil {
		return dtos.WithdrawalDto{}, err
	}
	return ConvertWithdrawal(reversed), withdrawals.Container.Outbox.EnqueueInTransaction(ctx, transaction, "withdrawal."+string(status), locked.ID.String(), now, withdrawalEventData(reversed))
}

func (withdrawals Withdrawals) lockWithdrawal(ctx context.Context, transaction *sql.Tx, withdrawalId uuid.UUID) (*ent.Withdrawal, error) {
	locked, err := withdrawals.Container.Client(transaction).Withdrawal.Query().Where(withdrawal.ID(withdrawalId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrWithdrawalNotFound
	}
	return locked, err
}

func ConvertWithdrawal(row *ent.Withdrawal) dtos.WithdrawalDto {
	status := "pending"
	switch row.Status {
	case withdrawal.StatusPaid:
		status = "completed"
	case withdrawal.StatusFailed, withdrawal.StatusCancelled:
		status = "failed"
	}
	converted := dtos.WithdrawalDto{
		WalletTransactionDto: dtos.WalletTransactionDto{
			Id: row.ID.String(), Kind: "debit", Amount: dtos.MoneyDto{AmountMinor: row.AmountMinor, Currency: row.Currency},
			Description: row.DestinationLabel, CreatedAt: row.CreatedAt, Status: status,
		},
		Reference: row.Reference, Fee: dtos.MoneyDto{AmountMinor: row.FeeMinor, Currency: row.Currency},
		NetAmount: dtos.MoneyDto{AmountMinor: row.NetMinor, Currency: row.Currency}, WithdrawalStatus: string(row.Status),
		PayoutAccountId: row.PayoutAccountID.String(), ProcessedAt: row.ProcessedAt,
	}
	if row.FailureReason != "" {
		reason := row.FailureReason
		converted.FailureReason = &reason
	}
	return converted
}

func withdrawalEventData(row *ent.Withdrawal) map[string]any {
	return map[string]any{
		"withdrawalId": row.ID.String(), "userId": row.UserID, "status": string(row.Status), "reference": row.Reference,
		"amount": map[string]any{"amountMinor": row.AmountMinor, "currency": row.Currency},
		"fee":    map[string]any{"amountMinor": row.FeeMinor, "currency": row.Currency},
	}
}

func truncate(value string, maximum int) string {
	if len(value) <= maximum {
		return value
	}
	return value[:maximum]
}

func (withdrawals Withdrawals) sumWithdrawalsNotYetSentToProvider(ctx context.Context, transaction *sql.Tx, userId, currency string) (int64, error) {
	var sums []struct {
		Sum *int64 `json:"sum"`
	}
	notYetSent := statusesToSubtractFromProviderBalance(withdrawals.Container.Settings.WithdrawalLimits.BlockWhileProcessing)
	err := withdrawals.Container.Client(transaction).Withdrawal.Query().
		Where(withdrawal.UserID(userId), withdrawal.Currency(currency), withdrawal.StatusIn(notYetSent...)).
		Aggregate(ent.Sum(withdrawal.FieldAmountMinor)).Scan(ctx, &sums)
	if err != nil || len(sums) == 0 || sums[0].Sum == nil {
		return 0, err
	}
	return *sums[0].Sum, nil
}

func statusesToSubtractFromProviderBalance(blockWhileProcessing bool) []withdrawal.Status {
	statuses := []withdrawal.Status{withdrawal.StatusPendingReview, withdrawal.StatusOnHold, withdrawal.StatusQueued}
	if !blockWhileProcessing {
		statuses = append(statuses, withdrawal.StatusProcessing)
	}
	return statuses
}

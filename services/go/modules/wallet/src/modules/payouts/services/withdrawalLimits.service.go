package services

import (
	"context"
	"database/sql"
	"net/http"

	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/withdrawal"
	"zudomart/platform/httpserver"
)

var (
	ErrPayoutAccountCoolingDown = httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYOUT_ACCOUNT_COOLING_DOWN", "New payout accounts can receive withdrawals 48 hours after they are added.")
	ErrWithdrawalInProgress     = httpserver.NewApiError(http.StatusConflict, "WITHDRAWAL_IN_PROGRESS", "Wait for your current withdrawal to finish first.")
	ErrWithdrawalTooSoon        = httpserver.NewApiError(http.StatusTooManyRequests, "WITHDRAWAL_TOO_SOON", "Wait a few minutes before another withdrawal.")
	ErrWithdrawalDailyCount     = httpserver.NewApiError(http.StatusTooManyRequests, "WITHDRAWAL_DAILY_LIMIT", "You have reached today's number of withdrawals.")
	ErrWithdrawalDailyAmount    = httpserver.NewApiError(http.StatusUnprocessableEntity, "WITHDRAWAL_DAILY_AMOUNT_LIMIT", "This would go over your daily withdrawal limit.")
	ErrWithdrawalNoDailyLimit   = httpserver.NewApiError(http.StatusUnprocessableEntity, "WITHDRAWAL_CURRENCY_NOT_AVAILABLE", "Withdrawals in this currency are not available for your account yet.")
)

func (withdrawals Withdrawals) LockUserForWithdrawal(ctx context.Context, transaction *sql.Tx, userId string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "wallet-withdraw:"+userId)
	return err
}

func (withdrawals Withdrawals) enforceWithdrawalLimits(ctx context.Context, transaction *sql.Tx, userId string, account *ent.PayoutAccount, amountMinor int64, currency string, level int) error {
	limits := withdrawals.Container.Settings.WithdrawalLimits
	now := withdrawals.Container.Now().UTC()
	if limits.NewAccountCooldown > 0 && account.CreatedAt.After(now.Add(-limits.NewAccountCooldown)) {
		return ErrPayoutAccountCoolingDown
	}
	client := withdrawals.Container.Client(transaction)
	if limits.BlockWhileProcessing {
		busy, err := client.Withdrawal.Query().Where(withdrawal.UserID(userId), withdrawal.StatusEQ(withdrawal.StatusProcessing)).Exist(ctx)
		if err != nil {
			return err
		}
		if busy {
			return ErrWithdrawalInProgress
		}
	}
	recent, err := client.Withdrawal.Query().Where(withdrawal.UserID(userId), withdrawal.StatusNEQ(withdrawal.StatusCancelled), withdrawal.CreatedAtGTE(now.AddDate(0, 0, -1))).All(ctx)
	if err != nil {
		return err
	}
	if limits.MaximumPerDay > 0 && len(recent) >= limits.MaximumPerDay {
		return ErrWithdrawalDailyCount
	}
	usedToday := int64(0)
	for _, row := range recent {
		if limits.MinimumGap > 0 && row.CreatedAt.After(now.Add(-limits.MinimumGap)) {
			return ErrWithdrawalTooSoon
		}
		if row.Currency == currency && row.Status != withdrawal.StatusFailed {
			usedToday += row.AmountMinor
		}
	}
	cap, capped := limits.DailyCapFor(level, currency)
	if !capped {
		return ErrWithdrawalNoDailyLimit
	}
	if amountMinor > cap || usedToday > cap-amountMinor {
		return ErrWithdrawalDailyAmount
	}
	return nil
}

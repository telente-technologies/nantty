package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/jackc/pgx/v5"

	"nantty/modules/ledger/src/databases"

	"nantty/modules/ledger/src/loaders"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/modules/gateway/models"
)

const (
	WalletTierBasic = "basic"
	WalletTierMid   = "mid"
	WalletTierFull  = "full"
)

var walletDayLocation = func() *time.Location {
	location, err := time.LoadLocation("Africa/Lagos")
	if err != nil {
		return time.FixedZone("WAT", 3600)
	}
	return location
}()

func WalletTierLimit(daily loaders.WalletDailyAmounts, tier string) int64 {
	switch tier {
	case WalletTierFull:
		return daily.Full
	case WalletTierMid:
		return daily.Mid
	}
	return daily.Basic
}

type WalletDailyLimitView struct {
	Tier           string            `json:"tier"`
	DailyLimit     WalletLimitAmount `json:"dailyLimit"`
	SpentToday     WalletLimitAmount `json:"spentToday"`
	RemainingToday WalletLimitAmount `json:"remainingToday"`
	ResetsAt       time.Time         `json:"resetsAt"`
}

type WalletLimitAmount struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type walletLimitExecutor interface {
	databases.ExecutorQuerier
	QueryRowContext(ctx context.Context, query string, arguments ...any) *sql.Row
}

func (gateway *PaymentGateway) walletTier(ctx context.Context, executor databases.ExecutorQuerier, userId string) (string, error) {
	view, err := gateway.ReadVerificationLevel(ctx, userId)
	if err != nil {
		return "", err
	}
	if view.Level < models.VerificationLevelIdentity {
		return WalletTierBasic, nil
	}
	business, err := gateway.IsSellerVerified(ctx, executor, userId)
	if err != nil {
		return "", err
	}
	if business {
		return WalletTierFull, nil
	}
	return WalletTierMid, nil
}

func (gateway *PaymentGateway) ReadWalletDailyLimit(ctx context.Context, executor walletLimitExecutor, userId, currency string) (WalletDailyLimitView, error) {
	tier, err := gateway.walletTier(ctx, executor, userId)
	if err != nil {
		return WalletDailyLimitView{}, err
	}
	limit := WalletTierLimit(gateway.PaymentLimitsIn(ctx, currency).WalletDaily, tier)
	local := gateway.Container.Now().In(walletDayLocation)
	dayStart := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, walletDayLocation)
	var spent int64
	table := pgx.Identifier{gateway.Container.Settings.Money.DatabaseSchema, "payment_intents"}.Sanitize()
	if err := executor.QueryRowContext(ctx, `SELECT COALESCE(SUM(amount_minor - refunded_minor), 0) FROM `+table+
		` WHERE owner_user_id = $1 AND currency = $2 AND status = 'succeeded' AND provider_transaction_id LIKE 'wallet:%' AND paid_at >= $3`, userId, currency, dayStart.UTC()).Scan(&spent); err != nil {
		return WalletDailyLimitView{}, err
	}
	spentOnPlatform, err := gateway.Container.Ledger.SumLinesOfKindPostedSince(ctx, executor, ledgermodels.WalletOutgoingAccount(userId, currency), ledgermodels.Credit, walletSpendJournalKind, dayStart.UTC())
	if err != nil {
		return WalletDailyLimitView{}, err
	}
	spent += spentOnPlatform
	return WalletDailyLimitView{
		Tier: tier, DailyLimit: WalletLimitAmount{limit, currency}, SpentToday: WalletLimitAmount{spent, currency},
		RemainingToday: WalletLimitAmount{max(limit-spent, 0), currency}, ResetsAt: dayStart.AddDate(0, 0, 1).UTC(),
	}, nil
}

func (gateway *PaymentGateway) requireWithinWalletDailyLimit(ctx context.Context, transaction *sql.Tx, userId, currency string, amountMinor int64) error {
	view, err := gateway.ReadWalletDailyLimit(ctx, transaction, userId, currency)
	if err != nil {
		return err
	}
	if view.DailyLimit.AmountMinor <= 0 || view.SpentToday.AmountMinor+amountMinor <= view.DailyLimit.AmountMinor {
		return nil
	}
	return ErrWalletDailyLimit.WithDetails(map[string]any{
		"tier": view.Tier, "limit": moneyDetail(view.DailyLimit.AmountMinor, currency), "remaining": moneyDetail(view.RemainingToday.AmountMinor, currency), "resetsAt": view.ResetsAt,
	})
}

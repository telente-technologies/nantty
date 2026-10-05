package services

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/loaders"
)

func (program CreatorProgram) applyAdminGiftShareTiers(ctx context.Context, executor databases.ExecutorQuerier, userId string, memberTierShareBps int64) (int64, error) {
	tiers, found := program.Container.Resources.Platform.ReadGiftShareTiers(ctx)
	if !found {
		return memberTierShareBps, nil
	}
	monthlyCoins, err := program.sumGiftCoinsCreditedThisMonth(ctx, executor, userId)
	if err != nil {
		return 0, err
	}
	return max(memberTierShareBps, loaders.GiftShareBpsForMonthlyVolume(tiers, monthlyCoins)), nil
}

func (program CreatorProgram) sumGiftCoinsCreditedThisMonth(ctx context.Context, executor databases.ExecutorQuerier, userId string) (int64, error) {
	now := program.Container.Now().UTC()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	table := pgx.Identifier{program.Container.Settings.Money.DatabaseSchema, "gift_transactions"}.Sanitize()
	rows, err := executor.QueryContext(ctx, "SELECT COALESCE(SUM(total_coins), 0) FROM "+table+" WHERE credited_user_id = $1 AND created_at >= $2 AND status = 'committed'", userId, monthStart)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	var total int64
	if rows.Next() {
		if err := rows.Scan(&total); err != nil {
			return 0, err
		}
	}
	return total, rows.Err()
}

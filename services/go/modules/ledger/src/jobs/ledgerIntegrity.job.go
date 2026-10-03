package jobs

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"zudomart/modules/ledger/src/container"
	"zudomart/modules/ledger/src/databases"
)

func RunLedgerIntegrityCheckEveryIntervalUntilContextDone(ctx context.Context, container *container.Container, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			checkLedgerIntegrityOnce(ctx, container)
		}
	}
}

func checkLedgerIntegrityOnce(ctx context.Context, container *container.Container) {
	logger := container.Resources.Logger
	report, err := container.Ledger.VerifyTrialBalanceAndCachedBalances(ctx, container.Resources.Database)
	if err != nil {
		logger.WarnContext(ctx, "ledger integrity check could not run", slog.Any("error", err))
		return
	}
	if report.Healthy() {
		return
	}
	logger.ErrorContext(ctx, "ledger integrity check failed", slog.Any("report", report))
	_ = databases.RunInMoneyTransaction(ctx, container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return container.Outbox.EnqueueInTransaction(ctx, transaction, "ledgerIntegrityCheck.failed", "ledger", container.Now(), report)
	})
}

func RunSellerCreditMaturingEveryIntervalUntilContextDone(ctx context.Context, container *container.Container, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := container.Sellers.MatureDueCredits(ctx, container.Resources.Database, 500); err != nil && ctx.Err() == nil {
				container.Resources.Logger.WarnContext(ctx, "seller credit maturing failed", slog.Any("error", err))
			}
		}
	}
}

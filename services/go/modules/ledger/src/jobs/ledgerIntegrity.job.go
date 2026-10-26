package jobs

import (
	"context"
	"database/sql"
	"log/slog"
	"sync"
	"time"

	"nantty/modules/ledger/src/container"
	"nantty/modules/ledger/src/databases"
)

type ProviderMirrorReconciler interface {
	ReconcileProviderHeldSellerFundsAgainstProviderBalances(ctx context.Context) (mismatchCount int, err error)
}

var (
	providerMirrorMutex      sync.RWMutex
	providerMirrorReconciler ProviderMirrorReconciler
)

func RegisterProviderMirrorReconciler(reconciler ProviderMirrorReconciler) {
	providerMirrorMutex.Lock()
	defer providerMirrorMutex.Unlock()
	providerMirrorReconciler = reconciler
}

func registeredProviderMirrorReconciler() ProviderMirrorReconciler {
	providerMirrorMutex.RLock()
	defer providerMirrorMutex.RUnlock()
	return providerMirrorReconciler
}

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
	if reconciler := registeredProviderMirrorReconciler(); reconciler != nil {
		mismatches, err := reconciler.ReconcileProviderHeldSellerFundsAgainstProviderBalances(ctx)
		if err != nil || mismatches > 0 {
			logger.ErrorContext(ctx, "provider-held seller funds do not match provider balances", slog.Int("mismatches", mismatches), slog.Any("error", err))
		}
	}
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

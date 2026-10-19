package jobs

import (
	"context"
	"log/slog"
	"time"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/checkout"
	"zudomart/modules/orders/src/services"
)

func ExpireOpenCheckouts(ctx context.Context, deployed *container.Container, batch int) (int, error) {
	rows, err := deployed.Client.Checkout.Query().Where(checkout.StatusIn(enums.CheckoutRegistering, enums.CheckoutPayable), checkout.ExpiresAtLTE(deployed.Now())).
		Order(ent.Asc(checkout.FieldExpiresAt)).Limit(batch).All(ctx)
	if err != nil {
		return 0, err
	}
	for _, row := range rows {
		if err := services.AbortCheckout(ctx, deployed, row.ID, enums.CheckoutExpired, "Payment was not completed in time"); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

func RunSweepsUntilContextDone(ctx context.Context, deployed *container.Container) {
	checkoutTicker := time.NewTicker(deployed.Settings.CheckoutSweepPeriod)
	creditTicker := time.NewTicker(deployed.Settings.CreditExpirySweepPeriod)
	defer checkoutTicker.Stop()
	defer creditTicker.Stop()
	rollupTicker := time.NewTicker(deployed.Settings.SuccessRateRollupPeriod)
	defer rollupTicker.Stop()
	refreshSuccessRates(ctx, deployed)
	for {
		select {
		case <-ctx.Done():
			return
		case <-checkoutTicker.C:
			if _, err := ExpireOpenCheckouts(ctx, deployed, 50); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "checkout expiry sweep failed", slog.Any("error", err))
			}
			if _, err := services.ReleaseStockOfClosedOrders(ctx, deployed, 50); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "stock release sweep failed", slog.Any("error", err))
			}
			if _, err := services.CompleteDirectOrdersPastTheirCompletionTime(ctx, deployed, 50); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "direct order auto-completion sweep failed", slog.Any("error", err))
			}
		case <-rollupTicker.C:
			refreshSuccessRates(ctx, deployed)
		case <-creditTicker.C:
			if err := services.RecordExpiredStoreCredit(ctx, deployed); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "store credit expiry sweep failed", slog.Any("error", err))
			}
		}
	}
}

func refreshSuccessRates(ctx context.Context, deployed *container.Container) {
	if err := services.RefreshStoreSuccessStats(ctx, deployed); err != nil && ctx.Err() == nil {
		deployed.Logger.WarnContext(ctx, "store success rate rollup failed", slog.Any("error", err))
	}
}

package jobs

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	adfundsservices "zudomart/modules/ads/src/modules/adFunds/services"
	"zudomart/modules/ads/src/services"
)

func ExpireDueAdCredit(ctx context.Context, deployed *container.Container) (int, error) {
	return services.ExpireDueCreditLots(ctx, deployed.Client, deployed.RunInTransaction, deployed.Now())
}

func runAdFundsJobsUntilContextDone(ctx context.Context, deployed *container.Container) {
	go runEvery(ctx, time.Minute, deployed, "ad credit expiry", func(ctx context.Context) error {
		_, err := ExpireDueAdCredit(ctx, deployed)
		return err
	})
	go runEvery(ctx, time.Minute, deployed, "ad balance withdrawal retries", func(ctx context.Context) error { return adfundsservices.RetryPendingWithdrawals(ctx, deployed) })
}

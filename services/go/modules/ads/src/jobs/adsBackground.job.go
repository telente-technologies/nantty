package jobs

import (
	"context"
	"log/slog"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/modules/reporting/delivery"
	"zudomart/modules/ads/src/services"
)

func RunBackgroundJobsUntilContextDone(ctx context.Context, deployed *container.Container) {
	settlement := services.AdSettlement{Client: deployed.Client, Now: deployed.Now}
	go runEvery(ctx, deployed.Settings.CandidateRefresh, deployed, "candidate refresh", func(ctx context.Context) error { return deployed.Candidates.ReloadFromDatabase(ctx) })
	go runEvery(ctx, deployed.Settings.SettlementInterval, deployed, "spend settlement", func(ctx context.Context) error {
		_, err := settlement.SettlePendingCharges(ctx)
		return err
	})
	go runEvery(ctx, deployed.Settings.SettlementInterval, deployed, "lifecycle sweep", func(ctx context.Context) error { return AdvanceFinishedItemsToCompleted(ctx, deployed) })
	go runEvery(ctx, deployed.Settings.ReportSweepInterval, deployed, "scheduled reports", func(ctx context.Context) error { return delivery.EnqueueDueReports(ctx, deployed) })
	if deployed.QueueConsumer != nil {
		go func() {
			if err := deployed.QueueConsumer.ConsumeQueueUntilContextDone(ctx, deployed.Settings.ReportQueueName, delivery.HandleQueueMessage(deployed), deployed.Logger); err != nil {
				deployed.Logger.Warn("scheduled report consumer stopped", slog.Any("error", err))
			}
		}()
	}
	go runEvery(ctx, deployed.Settings.RetentionInterval, deployed, "raw impression retention", func(ctx context.Context) error {
		_, err := PruneSettledRawImpressions(ctx, deployed)
		return err
	})
	<-ctx.Done()
}

func runEvery(ctx context.Context, interval time.Duration, deployed *container.Container, name string, work func(context.Context) error) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		if err := work(ctx); err != nil && ctx.Err() == nil {
			deployed.Logger.Warn("ads background job failed", slog.String("job", name), slog.Any("error", err))
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

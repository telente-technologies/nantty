package jobs

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adimpression"
)

const pruneBatchSize = 5_000

// Raw impressions are an operational buffer; the durable record is ad_stats_daily plus billed batches.
// Once a RANGE(id) partition scheme or the ClickHouse export is live, this becomes a partition drop.
func PruneSettledRawImpressions(ctx context.Context, deployed *container.Container) (int, error) {
	cutoff := deployed.Now().Add(-deployed.Settings.RawImpressionRetention)
	removed := 0
	for {
		ids, err := deployed.Client.AdImpression.Query().
			Where(adimpression.ServedAtLT(cutoff), adimpression.Or(adimpression.SettlementBatchIDNotNil(), adimpression.ChargeMicros(0))).
			Order(adimpression.ByServedAt()).Limit(pruneBatchSize).IDs(ctx)
		if err != nil || len(ids) == 0 {
			return removed, err
		}
		deleted, err := deployed.Client.AdImpression.Delete().Where(adimpression.IDIn(ids...)).Exec(ctx)
		if err != nil {
			return removed, err
		}
		removed += deleted
		select {
		case <-ctx.Done():
			return removed, ctx.Err()
		case <-time.After(200 * time.Millisecond):
		}
	}
}

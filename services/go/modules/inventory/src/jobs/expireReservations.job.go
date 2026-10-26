package jobs

import (
	"context"
	"log/slog"
	"time"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/services"
)

func RunReservationExpirySweepUntilContextDone(ctx context.Context, deployed *container.Container) {
	ticker := time.NewTicker(deployed.Settings.ReservationSweepPeriod)
	defer ticker.Stop()
	reservations := services.ReservationService{Container: deployed}
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := reservations.ExpireDueReservations(ctx, deployed.Settings.ReservationSweepBatch); err != nil && ctx.Err() == nil {
				deployed.Logger.WarnContext(ctx, "reservation expiry sweep failed", slog.Any("error", err))
			}
		}
	}
}

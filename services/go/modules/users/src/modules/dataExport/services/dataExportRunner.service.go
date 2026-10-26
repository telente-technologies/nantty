package services

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
)

func RunExportWorkerUntilContextDone(ctx context.Context, c *container.Container, processNext func(context.Context) (bool, error), expire func(context.Context) (int, error)) error {
	ticker := time.NewTicker(c.Settings.Privacy.ExportWorkerPollInterval)
	defer ticker.Stop()
	for {
		for {
			worked, err := processNext(ctx)
			if err != nil {
				c.Logger.WarnContext(ctx, "export worker iteration failed", "error", err.Error())
			}
			if err != nil || !worked {
				break
			}
		}
		if _, err := expire(ctx); err != nil {
			c.Logger.WarnContext(ctx, "export expiry sweep failed", "error", err.Error())
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

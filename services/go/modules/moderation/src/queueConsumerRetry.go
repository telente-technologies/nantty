package src

import (
	"context"
	"log/slog"
	"time"

	platformevents "nantty/platform/events"
)

type queueConsumerOpener func(context.Context, platformevents.MessageBusSelection) (platformevents.JobQueue, platformevents.QueueConsumer, error)

func openQueueConsumerWithRetry(ctx context.Context, logger *slog.Logger, name string, bus platformevents.MessageBusSelection, open queueConsumerOpener, initialDelay time.Duration) platformevents.QueueConsumer {
	delay := initialDelay
	for ctx.Err() == nil {
		_, queues, err := open(ctx, bus)
		if err == nil && queues == nil {
			logger.WarnContext(ctx, name+" disabled: no message broker configured")
			return nil
		}
		if err == nil {
			return queues
		}
		logger.ErrorContext(ctx, name+" setup failed; retrying", slog.Any("error", err), slog.Duration("retryIn", delay))
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(delay):
		}
		delay = min(delay*2, time.Minute)
	}
	return nil
}

package src

import (
	"context"
	"log/slog"
	"time"

	platformevents "nantty/platform/events"
)

type QueueConsumerOpener func(context.Context, platformevents.MessageBusSelection) (platformevents.JobQueue, platformevents.QueueConsumer, error)

func OpenQueueConsumerWithRetry(ctx context.Context, logger *slog.Logger, name string, bus platformevents.MessageBusSelection, open QueueConsumerOpener, initialDelay time.Duration) platformevents.QueueConsumer {
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

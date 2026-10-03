package events

import (
	"context"
	"log/slog"
	"time"
)

type OutboxStore interface {
	PublishPendingOutboxEventsInTransaction(ctx context.Context, limit int, publish func(context.Context, []OutboxEvent) error) (int, error)
}

type OutboxRelayOptions struct {
	Store        OutboxStore
	Publisher    DomainEventPublisher
	Logger       *slog.Logger
	PollInterval time.Duration
	BatchSize    int
}

func RelayOutboxEventsUntilContextDone(ctx context.Context, options OutboxRelayOptions) error {
	if options.PollInterval == 0 {
		options.PollInterval = 500 * time.Millisecond
	}
	if options.BatchSize == 0 {
		options.BatchSize = 100
	}
	ticker := time.NewTicker(options.PollInterval)
	defer ticker.Stop()
	for {
		published, err := options.Store.PublishPendingOutboxEventsInTransaction(ctx, options.BatchSize, options.Publisher.PublishDomainEvents)
		if err != nil && ctx.Err() == nil {
			options.Logger.WarnContext(ctx, "outbox relay batch failed", slog.Any("error", err))
		}
		if err == nil && published == options.BatchSize {
			continue
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

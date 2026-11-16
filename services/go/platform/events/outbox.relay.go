package events

import (
	"context"
	"errors"
	"fmt"
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
	MaximumDelay time.Duration
	BatchSize    int
}

func RelayOutboxEventsUntilContextDone(ctx context.Context, options OutboxRelayOptions) error {
	if options.PollInterval <= 0 {
		options.PollInterval = 500 * time.Millisecond
	}
	if options.MaximumDelay <= 0 {
		options.MaximumDelay = 30 * time.Second
	}
	if options.BatchSize == 0 {
		options.BatchSize = 100
	}
	consecutiveFailures := 0
	for {
		published, err := publishOneBatchRecoveringPanics(ctx, options)
		delay := options.PollInterval
		var partial PartialPublishError
		switch {
		case errors.As(err, &partial) && ctx.Err() == nil:
			consecutiveFailures = 0
			options.Logger.ErrorContext(ctx, "outbox events kept back after isolated publish failures", slog.Any("error", err))
		case err != nil && ctx.Err() == nil:
			consecutiveFailures++
			delay = OutboxBackoff(options.PollInterval, options.MaximumDelay, consecutiveFailures)
			options.Logger.WarnContext(ctx, "outbox relay batch failed", slog.Any("error", err), slog.Int("consecutiveFailures", consecutiveFailures), slog.Duration("nextAttemptIn", delay))
		case err == nil:
			consecutiveFailures = 0
			if published == options.BatchSize {
				continue
			}
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(delay):
		}
	}
}

func publishOneBatchRecoveringPanics(ctx context.Context, options OutboxRelayOptions) (published int, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("outbox relay panic: %v", recovered)
		}
	}()
	return options.Store.PublishPendingOutboxEventsInTransaction(ctx, options.BatchSize, options.Publisher.PublishDomainEvents)
}

func OutboxBackoff(base, maximum time.Duration, consecutiveFailures int) time.Duration {
	delay := base
	for step := 1; step < consecutiveFailures && delay < maximum; step++ {
		delay *= 2
	}
	return min(delay, maximum)
}

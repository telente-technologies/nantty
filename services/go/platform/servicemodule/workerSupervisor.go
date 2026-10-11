package servicemodule

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"time"
)

type SupervisorOptions struct {
	InitialDelay time.Duration
	MaximumDelay time.Duration
}

func SuperviseWorkerUntilContextDone(ctx context.Context, logger *slog.Logger, name string, worker func(context.Context) error) {
	SuperviseWorkerWithOptions(ctx, logger, name, SupervisorOptions{}, worker)
}

func SuperviseWorkerWithOptions(ctx context.Context, logger *slog.Logger, name string, options SupervisorOptions, worker func(context.Context) error) {
	if options.InitialDelay <= 0 {
		options.InitialDelay = time.Second
	}
	if options.MaximumDelay <= 0 {
		options.MaximumDelay = time.Minute
	}
	delay := options.InitialDelay
	for ctx.Err() == nil {
		startedAt := time.Now()
		err := runWorkerRecoveringPanics(ctx, worker)
		if ctx.Err() != nil {
			return
		}
		if time.Since(startedAt) > options.MaximumDelay {
			delay = options.InitialDelay
		}
		logger.ErrorContext(ctx, "background worker stopped; restarting", slog.String("worker", name), slog.Any("error", err), slog.Duration("restartIn", delay))
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		delay = min(delay*2, options.MaximumDelay)
	}
}

func runWorkerRecoveringPanics(ctx context.Context, worker func(context.Context) error) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("panic: %v\n%s", recovered, debug.Stack())
		}
	}()
	if err = worker(ctx); err == nil && ctx.Err() == nil {
		err = fmt.Errorf("worker returned before shutdown")
	}
	return err
}

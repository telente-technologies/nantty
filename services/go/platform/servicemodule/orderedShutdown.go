package servicemodule

import (
	"context"
	"errors"
	"time"

	"golang.org/x/sync/errgroup"
)

const shutdownHookTimeout = 20 * time.Second

type ShutdownPlan struct {
	Workers     []func(context.Context) error
	Serve       func(context.Context) error
	Hooks       []func(context.Context) error
	HookTimeout time.Duration
}

func RunWithOrderedShutdown(ctx context.Context, run ShutdownPlan) error {
	group, groupContext := errgroup.WithContext(ctx)
	for _, worker := range run.Workers {
		group.Go(func() error { return worker(groupContext) })
	}
	group.Go(func() error { return run.Serve(groupContext) })
	runError := group.Wait()
	timeout := run.HookTimeout
	if timeout <= 0 {
		timeout = shutdownHookTimeout
	}
	hookContext, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	for _, hook := range run.Hooks {
		runError = errors.Join(runError, hook(hookContext))
	}
	return runError
}

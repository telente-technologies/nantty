package servicemodule

import (
	"context"
	"fmt"

	"golang.org/x/sync/errgroup"
)

type NamedWorker struct {
	Name string
	Run  func(context.Context) error
}

func RunWorkersStoppingAllOnFirstFailure(ctx context.Context, workers ...NamedWorker) error {
	group, groupContext := errgroup.WithContext(ctx)
	for _, worker := range workers {
		group.Go(func() error {
			if err := worker.Run(groupContext); err != nil && groupContext.Err() == nil {
				return fmt.Errorf("%s: %w", worker.Name, err)
			}
			return nil
		})
	}
	return group.Wait()
}

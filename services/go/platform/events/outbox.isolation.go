package events

import (
	"context"
	"errors"
	"fmt"
)

const consecutiveSingleFailuresBeforeGivingUp = 3

type PartialPublishError struct {
	Published int
	Failed    int
	Cause     error
}

func (failure PartialPublishError) Error() string {
	return fmt.Sprintf("published %d outbox events, %d kept back: %v", failure.Published, failure.Failed, failure.Cause)
}

func (failure PartialPublishError) Unwrap() error { return failure.Cause }

func PublishIsolatingFailures(ctx context.Context, batch []OutboxEvent, publish func(context.Context, []OutboxEvent) error) ([]int, error) {
	batchError := publish(ctx, batch)
	if batchError == nil {
		published := make([]int, len(batch))
		for index := range batch {
			published[index] = index
		}
		return published, nil
	}
	if len(batch) == 1 {
		return nil, batchError
	}
	published := []int{}
	failures := []error{}
	consecutiveFailures := 0
	for index, event := range batch {
		if ctx.Err() != nil {
			break
		}
		if err := publish(ctx, []OutboxEvent{event}); err != nil {
			failures = append(failures, fmt.Errorf("event %s (%s): %w", event.Id, event.EventType, err))
			consecutiveFailures++
			if len(published) == 0 && consecutiveFailures >= consecutiveSingleFailuresBeforeGivingUp {
				break
			}
			continue
		}
		consecutiveFailures = 0
		published = append(published, index)
	}
	if len(published) == 0 {
		return nil, batchError
	}
	return published, PartialPublishError{Published: len(published), Failed: len(batch) - len(published), Cause: errors.Join(failures...)}
}

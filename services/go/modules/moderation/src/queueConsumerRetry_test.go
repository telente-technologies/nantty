package src

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	platformevents "zudomart/platform/events"
)

type fakeQueueConsumer struct{ platformevents.QueueConsumer }

func TestATransientBrokerSetupErrorIsRetriedInsteadOfDisablingConsumers(t *testing.T) {
	attempts := 0
	open := func(context.Context, platformevents.MessageBusSelection) (platformevents.JobQueue, platformevents.QueueConsumer, error) {
		attempts++
		if attempts < 3 {
			return nil, nil, errors.New("aws config unavailable")
		}
		return nil, fakeQueueConsumer{}, nil
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if queues := openQueueConsumerWithRetry(ctx, logger, "test consumers", platformevents.MessageBusSelection{}, open, time.Millisecond); queues == nil || attempts != 3 {
		t.Fatalf("queues=%v attempts=%d, want a consumer after 3 attempts", queues, attempts)
	}
}

func TestNoConfiguredBrokerOutsideProductionDisablesWithoutRetrying(t *testing.T) {
	attempts := 0
	open := func(context.Context, platformevents.MessageBusSelection) (platformevents.JobQueue, platformevents.QueueConsumer, error) {
		attempts++
		return nil, nil, nil
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if queues := openQueueConsumerWithRetry(context.Background(), logger, "test consumers", platformevents.MessageBusSelection{}, open, time.Millisecond); queues != nil || attempts != 1 {
		t.Fatalf("queues=%v attempts=%d, want disabled after one attempt", queues, attempts)
	}
}

func TestRetryingStopsWhenTheContextEnds(t *testing.T) {
	open := func(context.Context, platformevents.MessageBusSelection) (platformevents.JobQueue, platformevents.QueueConsumer, error) {
		return nil, nil, errors.New("down")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if queues := openQueueConsumerWithRetry(ctx, logger, "test consumers", platformevents.MessageBusSelection{}, open, 10*time.Millisecond); queues != nil {
		t.Fatal("expected nil once the context ended")
	}
}

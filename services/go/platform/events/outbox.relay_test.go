package events

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

type failingOutboxStore struct {
	calls atomic.Int32
	panic bool
}

func (store *failingOutboxStore) PublishPendingOutboxEventsInTransaction(context.Context, int, func(context.Context, []OutboxEvent) error) (int, error) {
	store.calls.Add(1)
	if store.panic {
		panic("poison row")
	}
	return 0, errors.New("broker down")
}

func TestOutboxRelayBacksOffWhileTheBrokerIsDown(t *testing.T) {
	store := &failingOutboxStore{}
	ctx, cancel := context.WithTimeout(context.Background(), 350*time.Millisecond)
	defer cancel()
	_ = RelayOutboxEventsUntilContextDone(ctx, OutboxRelayOptions{Store: store, Publisher: DiscardingPublisher{}, Logger: discardLogger(), PollInterval: 20 * time.Millisecond, MaximumDelay: time.Second})
	if calls := store.calls.Load(); calls < 2 || calls > 6 {
		t.Fatalf("calls = %d in 350ms, want exponential backoff (20, 40, 80, 160ms)", calls)
	}
}

func TestOutboxRelaySurvivesAPanickingBatch(t *testing.T) {
	store := &failingOutboxStore{panic: true}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	if err := RelayOutboxEventsUntilContextDone(ctx, OutboxRelayOptions{Store: store, Publisher: DiscardingPublisher{}, Logger: discardLogger(), PollInterval: 10 * time.Millisecond}); err != nil {
		t.Fatal(err)
	}
	if store.calls.Load() < 2 {
		t.Fatal("the relay must keep running after a panic")
	}
}

func TestOutboxBackoffIsCapped(t *testing.T) {
	if got := outboxBackoff(500*time.Millisecond, 30*time.Second, 40); got != 30*time.Second {
		t.Fatalf("backoff = %s, want the 30s cap", got)
	}
	if got := outboxBackoff(500*time.Millisecond, 30*time.Second, 1); got != 500*time.Millisecond {
		t.Fatalf("first failure delay = %s", got)
	}
}

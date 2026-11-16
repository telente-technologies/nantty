package events_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"nantty/platform/events"
)

func eventsWithIds(ids ...string) []events.OutboxEvent {
	batch := make([]events.OutboxEvent, 0, len(ids))
	for _, id := range ids {
		batch = append(batch, events.OutboxEvent{Id: id, EventType: "test.happened"})
	}
	return batch
}

func TestAPoisonEventNoLongerBlocksTheRestOfTheStream(t *testing.T) {
	delivered := []string{}
	publish := func(_ context.Context, batch []events.OutboxEvent) error {
		for _, event := range batch {
			if event.Id == "poison" {
				return errors.New("message too large")
			}
		}
		for _, event := range batch {
			delivered = append(delivered, event.Id)
		}
		return nil
	}
	published, err := events.PublishIsolatingFailures(context.Background(), eventsWithIds("poison", "a", "b"), publish)
	var partial events.PartialPublishError
	if !errors.As(err, &partial) || partial.Published != 2 || partial.Failed != 1 {
		t.Fatalf("err = %v, want a partial publish of 2 with 1 kept back", err)
	}
	if !slices.Equal(published, []int{1, 2}) || !slices.Equal(delivered, []string{"a", "b"}) {
		t.Fatalf("published=%v delivered=%v, want the two healthy events", published, delivered)
	}
}

func TestABrokerOutageStopsAfterAFewSingleAttempts(t *testing.T) {
	calls := 0
	publish := func(context.Context, []events.OutboxEvent) error {
		calls++
		return errors.New("broker unreachable")
	}
	published, err := events.PublishIsolatingFailures(context.Background(), eventsWithIds("a", "b", "c", "d", "e", "f"), publish)
	if err == nil || len(published) != 0 {
		t.Fatalf("published=%v err=%v, want nothing published and an error", published, err)
	}
	if calls != 4 {
		t.Fatalf("calls = %d, want the batch plus three single attempts", calls)
	}
}

func TestAHealthyBatchIsPublishedInOneCall(t *testing.T) {
	calls := 0
	published, err := events.PublishIsolatingFailures(context.Background(), eventsWithIds("a", "b"), func(context.Context, []events.OutboxEvent) error { calls++; return nil })
	if err != nil || calls != 1 || !slices.Equal(published, []int{0, 1}) {
		t.Fatalf("published=%v err=%v calls=%d", published, err, calls)
	}
}

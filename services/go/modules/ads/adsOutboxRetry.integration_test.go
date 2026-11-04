package ads

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent/outboxevent"
	platformevents "nantty/platform/events"
)

func TestAdsOutboxPersistsRetryAndWaitsUntilDue(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	now := h.clock.Now()
	id := uuid.New()
	if err := h.module.Container.Client.OutboxEvent.Create().
		SetID(id).
		SetCreatedAt(now).
		SetEventType("ad.testEvent").
		SetSubject("ad-test").
		SetPayload([]byte(`{}`)).
		Exec(ctx); err != nil {
		t.Fatal(err)
	}
	store := events.EntOutboxStore{Client: h.module.Container.Client, Now: h.clock.Now}
	failed := true
	publishCalls := 0
	publish := func(context.Context, []platformevents.OutboxEvent) error {
		publishCalls++
		if failed {
			return errors.New("broker unavailable")
		}
		return nil
	}
	if published, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); published != 0 || err == nil {
		t.Fatalf("failed publication should be persisted for retry: published=%d err=%v", published, err)
	}
	row := h.module.Container.Client.OutboxEvent.Query().Where(outboxevent.IDEQ(id)).OnlyX(ctx)
	if row.AttemptCount != 1 || row.LastError != "broker unavailable" || row.NextAttemptAt == nil || !row.NextAttemptAt.Equal(now.Add(2*time.Second)) || row.PublishedAt != nil {
		t.Fatalf("failed event retry state not persisted: %+v", row)
	}
	if _, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); err != nil {
		t.Fatal(err)
	}
	if publishCalls != 2 {
		t.Fatalf("event retried before next_attempt_at: calls=%d", publishCalls)
	}

	failed = false
	h.clock.Advance(2 * time.Second)
	if published, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); published != 1 || err != nil {
		t.Fatalf("due event should publish: published=%d err=%v", published, err)
	}
	row = h.module.Container.Client.OutboxEvent.Query().Where(outboxevent.IDEQ(id)).OnlyX(ctx)
	if row.PublishedAt == nil || row.AttemptCount != 1 {
		t.Fatalf("successful retry should mark the event published and preserve failure history: %+v", row)
	}
}

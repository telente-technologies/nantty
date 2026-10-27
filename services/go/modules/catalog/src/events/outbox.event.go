package events

import (
	"context"
	"fmt"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/outboxevent"
	"nantty/platform/events"
)

func EnqueueOutboxEventInTransaction(ctx context.Context, tx *ent.Tx, eventType, subject string, occurredAt time.Time, data any) error {
	event, err := events.BuildOutboxEventWithEnvelope(eventType, EventSource, subject, 1, occurredAt, data)
	if err != nil {
		return err
	}
	return tx.OutboxEvent.Create().
		SetID(uuid.MustParse(event.Id)).
		SetEventType(event.EventType).
		SetSubject(event.Subject).
		SetPayload(event.Payload).
		SetCreatedAt(occurredAt).
		Exec(ctx)
}

const EventSource = "nantty.catalog"

type EntOutboxStore struct {
	Client *ent.Client
	Now    func() time.Time
}

func (store EntOutboxStore) PublishPendingOutboxEventsInTransaction(ctx context.Context, limit int, publish func(context.Context, []events.OutboxEvent) error) (int, error) {
	tx, err := store.Client.Tx(ctx)
	if err != nil {
		return 0, err
	}
	pending, err := tx.OutboxEvent.Query().
		Where(outboxevent.PublishedAtIsNil()).
		Order(ent.Asc(outboxevent.FieldCreatedAt)).
		Limit(limit).
		ForUpdate(sql.WithLockAction(sql.SkipLocked)).
		All(ctx)
	if err != nil || len(pending) == 0 {
		return 0, rollbackAndJoin(tx, err)
	}
	batch := make([]events.OutboxEvent, 0, len(pending))
	identifiers := make([]uuid.UUID, 0, len(pending))
	for _, row := range pending {
		batch = append(batch, events.OutboxEvent{Id: row.ID.String(), EventType: row.EventType, Subject: row.Subject, Payload: row.Payload})
		identifiers = append(identifiers, row.ID)
	}
	publishedIndexes, publishError := events.PublishIsolatingFailures(ctx, batch, publish)
	if len(publishedIndexes) == 0 {
		return 0, rollbackAndJoin(tx, fmt.Errorf("publish outbox events: %w", publishError))
	}
	published := make([]uuid.UUID, 0, len(publishedIndexes))
	for _, index := range publishedIndexes {
		published = append(published, identifiers[index])
	}
	if err := tx.OutboxEvent.Update().Where(outboxevent.IDIn(published...)).SetPublishedAt(store.Now()).Exec(ctx); err != nil {
		return 0, rollbackAndJoin(tx, err)
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return len(published), publishError
}

func rollbackAndJoin(tx *ent.Tx, err error) error {
	rollbackError := tx.Rollback()
	if err != nil {
		return err
	}
	return rollbackError
}

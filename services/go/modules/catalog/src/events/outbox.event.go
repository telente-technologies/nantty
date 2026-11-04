package events

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
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

const (
	publishAttemptsBeforeAlert = 10
	maximumRetryBackoff        = 15 * time.Minute
)

type EntOutboxStore struct {
	Client *ent.Client
	Now    func() time.Time
	Logger *slog.Logger
}

func (store EntOutboxStore) PublishPendingOutboxEventsInTransaction(ctx context.Context, limit int, publish func(context.Context, []events.OutboxEvent) error) (int, error) {
	now := store.now()
	tx, err := store.Client.Tx(ctx)
	if err != nil {
		return 0, err
	}
	pending, err := tx.OutboxEvent.Query().Where(
		outboxevent.PublishedAtIsNil(),
		outboxevent.Or(outboxevent.NextAttemptAtIsNil(), outboxevent.NextAttemptAtLTE(now)),
	).Order(ent.Asc(outboxevent.FieldCreatedAt)).Limit(limit).ForUpdate(sql.WithLockAction(sql.SkipLocked)).All(ctx)
	if err != nil || len(pending) == 0 {
		return 0, rollbackAndJoin(tx, err)
	}
	batch := make([]events.OutboxEvent, 0, len(pending))
	identifiers := make([]uuid.UUID, 0, len(pending))
	for _, row := range pending {
		batch = append(batch, events.OutboxEvent{Id: row.ID.String(), EventType: row.EventType, Subject: row.Subject, Payload: row.Payload})
		identifiers = append(identifiers, row.ID)
	}
	publishedIndexes := make(map[int]struct{}, len(batch))
	failedIndexes := make(map[int]error)
	var publishErrors []error
	if batchError := publish(ctx, batch); batchError == nil {
		for index := range batch {
			publishedIndexes[index] = struct{}{}
		}
	} else {
		for index, event := range batch {
			if ctx.Err() != nil {
				break
			}
			if eventError := publish(ctx, []events.OutboxEvent{event}); eventError != nil {
				failedIndexes[index] = eventError
				publishErrors = append(publishErrors, fmt.Errorf("publish outbox event %s: %w", event.Id, eventError))
				continue
			}
			publishedIndexes[index] = struct{}{}
		}
	}
	for index, row := range pending {
		if _, published := publishedIndexes[index]; published {
			if err := tx.OutboxEvent.UpdateOneID(identifiers[index]).SetPublishedAt(now).Exec(ctx); err != nil {
				return 0, rollbackAndJoin(tx, err)
			}
			continue
		}
		publishError, attempted := failedIndexes[index]
		if attempted {
			if err := store.recordFailedAttempt(ctx, tx, row, publishError, now); err != nil {
				return 0, rollbackAndJoin(tx, err)
			}
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return len(publishedIndexes), errors.Join(publishErrors...)
}

func (store EntOutboxStore) recordFailedAttempt(ctx context.Context, tx *ent.Tx, row *ent.OutboxEvent, publishError error, now time.Time) error {
	attempts := row.AttemptCount + 1
	message := publishError.Error()
	if len(message) > 1000 {
		message = message[:1000]
	}
	update := tx.OutboxEvent.UpdateOneID(row.ID).
		SetAttemptCount(attempts).
		SetLastError(message).
		SetNextAttemptAt(now.Add(retryBackoffAfterAttempts(attempts)))
	if attempts >= publishAttemptsBeforeAlert && row.DeadLetteredAt == nil {
		update.SetDeadLetteredAt(now)
	}
	if attempts == publishAttemptsBeforeAlert || (attempts > publishAttemptsBeforeAlert && attempts%publishAttemptsBeforeAlert == 0) {
		store.logger().ErrorContext(ctx, "catalog outbox event remains unpublished and will keep retrying", "alert", "catalogOutboxStuck", "eventId", row.ID, "eventType", row.EventType, "attempts", attempts, "error", message)
	}
	_, err := update.Save(ctx)
	return err
}

func (store EntOutboxStore) now() time.Time {
	if store.Now != nil {
		return store.Now()
	}
	return time.Now()
}

func (store EntOutboxStore) logger() *slog.Logger {
	if store.Logger != nil {
		return store.Logger
	}
	return slog.Default()
}

func retryBackoffAfterAttempts(attempts int) time.Duration {
	if attempts > 20 {
		return maximumRetryBackoff
	}
	delay := time.Second << attempts
	if delay > maximumRetryBackoff {
		return maximumRetryBackoff
	}
	return delay
}

func rollbackAndJoin(tx *ent.Tx, err error) error {
	rollbackError := tx.Rollback()
	if err != nil {
		return err
	}
	return rollbackError
}

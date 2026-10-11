package events

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	platformevents "zudomart/platform/events"
)

const (
	PublishAttemptsBeforeAlert = 10
	maximumRetryBackoff        = 15 * time.Minute
)

type OutboxTable struct {
	Schema string
	Source string
}

func (table OutboxTable) qualifiedName() string {
	return pgx.Identifier{table.Schema, "outbox_events"}.Sanitize()
}

func (table OutboxTable) EnqueueInTransaction(ctx context.Context, transaction *sql.Tx, eventType, subject string, occurredAt time.Time, data any) error {
	event, err := platformevents.BuildOutboxEventWithEnvelope(eventType, table.Source, subject, 1, occurredAt, data)
	if err != nil {
		return err
	}
	_, err = transaction.ExecContext(ctx,
		"INSERT INTO "+table.qualifiedName()+" (id, created_at, event_type, subject, payload, attempt_count, last_error) VALUES ($1, $2, $3, $4, $5, 0, '')",
		event.Id, occurredAt, event.EventType, event.Subject, event.Payload)
	if err != nil {
		return fmt.Errorf("enqueue %s: %w", eventType, err)
	}
	return nil
}

type OutboxRelayStore struct {
	Database *sql.DB
	Table    OutboxTable
	Now      func() time.Time
	Logger   *slog.Logger
}

type pendingOutboxRow struct {
	event        platformevents.OutboxEvent
	attemptCount int
}

func (store OutboxRelayStore) PublishPendingOutboxEventsInTransaction(ctx context.Context, limit int, publish func(context.Context, []platformevents.OutboxEvent) error) (int, error) {
	transaction, err := store.Database.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	now := store.Now()
	rows, err := store.lockDueRows(ctx, transaction, limit, now)
	if err != nil || len(rows) == 0 {
		return 0, errors.Join(err, transaction.Rollback())
	}
	published := 0
	for _, row := range rows {
		if publishError := publish(ctx, []platformevents.OutboxEvent{row.event}); publishError != nil {
			if err := store.recordFailedAttempt(ctx, transaction, row, publishError, now); err != nil {
				return 0, errors.Join(err, transaction.Rollback())
			}
			continue
		}
		if _, err := transaction.ExecContext(ctx, "UPDATE "+store.Table.qualifiedName()+" SET published_at = $1 WHERE id = $2", now, row.event.Id); err != nil {
			return 0, errors.Join(err, transaction.Rollback())
		}
		published++
	}
	return published, transaction.Commit()
}

func (store OutboxRelayStore) lockDueRows(ctx context.Context, transaction *sql.Tx, limit int, now time.Time) ([]pendingOutboxRow, error) {
	result, err := transaction.QueryContext(ctx,
		"SELECT id, event_type, subject, payload, attempt_count FROM "+store.Table.qualifiedName()+
			" WHERE published_at IS NULL AND (next_attempt_at IS NULL OR next_attempt_at <= $1)"+
			" ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED", now, limit)
	if err != nil {
		return nil, err
	}
	defer result.Close()
	var rows []pendingOutboxRow
	for result.Next() {
		var row pendingOutboxRow
		if err := result.Scan(&row.event.Id, &row.event.EventType, &row.event.Subject, &row.event.Payload, &row.attemptCount); err != nil {
			return nil, err
		}
		rows = append(rows, row)
	}
	return rows, result.Err()
}

func (store OutboxRelayStore) recordFailedAttempt(ctx context.Context, transaction *sql.Tx, row pendingOutboxRow, publishError error, now time.Time) error {
	attempts := row.attemptCount + 1
	message := publishError.Error()
	if len(message) > 1000 {
		message = message[:1000]
	}
	if attempts == PublishAttemptsBeforeAlert || (attempts > PublishAttemptsBeforeAlert && attempts%PublishAttemptsBeforeAlert == 0) {
		store.logger().ErrorContext(ctx, "money outbox event still unpublished; it keeps retrying and is never dropped",
			"alert", "moneyOutboxStuck", "outbox", store.Table.Schema, "eventId", row.event.Id, "eventType", row.event.EventType, "attempts", attempts, "error", message)
	}
	_, err := transaction.ExecContext(ctx,
		"UPDATE "+store.Table.qualifiedName()+" SET attempt_count = $1, last_error = $2, next_attempt_at = $3, dead_lettered_at = CASE WHEN $4::boolean THEN COALESCE(dead_lettered_at, $5) ELSE dead_lettered_at END WHERE id = $6",
		attempts, message, now.Add(RetryBackoffAfterAttempts(attempts)), attempts >= PublishAttemptsBeforeAlert, now, row.event.Id)
	return err
}

func (store OutboxRelayStore) logger() *slog.Logger {
	if store.Logger != nil {
		return store.Logger
	}
	return slog.Default()
}

func RetryBackoffAfterAttempts(attempts int) time.Duration {
	if attempts > 20 {
		return maximumRetryBackoff
	}
	backoff := time.Second << attempts
	if backoff > maximumRetryBackoff {
		return maximumRetryBackoff
	}
	return backoff
}

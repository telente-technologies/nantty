package events

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"nantty/modules/ledger/src/databases"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/migrations"
	platformevents "nantty/platform/events"
)

func TestStuckEventKeepsRetryingPastTheAlertThresholdAndIsDeliveredWhenTheBrokerRecovers(t *testing.T) {
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	schema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "outbox", migrations.Files)
	table := OutboxTable{Schema: schema, Source: "zudomart.test"}
	ctx := context.Background()
	err := databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		for _, subject := range []string{"poison", "healthy-1", "healthy-2"} {
			if err := table.EnqueueInTransaction(ctx, transaction, "test.happened", subject, time.Now(), map[string]string{"subject": subject}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	clock := time.Now()
	store := OutboxRelayStore{Database: database, Table: table, Now: func() time.Time { return clock }}
	delivered := map[string]int{}
	brokerDown := true
	publish := func(_ context.Context, batch []platformevents.OutboxEvent) error {
		if batch[0].Subject == "poison" && brokerDown {
			return errors.New("broker rejected the message")
		}
		delivered[batch[0].Subject]++
		return nil
	}
	published, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish)
	if err != nil || published != 2 || delivered["healthy-1"] != 1 || delivered["healthy-2"] != 1 {
		t.Fatalf("first pass: published=%d err=%v delivered=%v", published, err, delivered)
	}
	if published, _ := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); published != 0 {
		t.Fatalf("backoff not honoured: published %d", published)
	}
	for attempt := 2; attempt <= 3*PublishAttemptsBeforeAlert; attempt++ {
		clock = clock.Add(maximumRetryBackoff + time.Second)
		if _, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); err != nil {
			t.Fatal(err)
		}
	}
	var attempts int
	var alerted, publishedAt sql.NullTime
	if err := database.QueryRow("SELECT attempt_count, dead_lettered_at, published_at FROM "+table.qualifiedName()+" WHERE subject = 'poison'").Scan(&attempts, &alerted, &publishedAt); err != nil {
		t.Fatal(err)
	}
	if attempts != 3*PublishAttemptsBeforeAlert || !alerted.Valid || publishedAt.Valid {
		t.Fatalf("a stuck event keeps retrying and is flagged for alerting: attempts=%d alerted=%v published=%v", attempts, alerted.Valid, publishedAt.Valid)
	}
	if backoff := RetryBackoffAfterAttempts(attempts); backoff != maximumRetryBackoff {
		t.Fatalf("backoff must be capped, got %s", backoff)
	}
	brokerDown = false
	clock = clock.Add(maximumRetryBackoff + time.Second)
	if published, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); err != nil || published != 1 || delivered["poison"] != 1 || delivered["healthy-1"] != 1 {
		t.Fatalf("once the broker recovers the stuck event is delivered, never dropped: published=%d err=%v delivered=%v", published, err, delivered)
	}
}

func TestRetryBackoffGrowsAndIsCapped(t *testing.T) {
	cases := map[int]time.Duration{1: 2 * time.Second, 2: 4 * time.Second, 5: 32 * time.Second, 12: maximumRetryBackoff, 40: maximumRetryBackoff}
	for attempts, want := range cases {
		if got := RetryBackoffAfterAttempts(attempts); got != want {
			t.Errorf("attempts %d: got %s want %s", attempts, got, want)
		}
	}
}

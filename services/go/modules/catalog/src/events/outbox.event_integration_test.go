package events

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/outboxevent"
	"nantty/modules/catalog/src/migrations"
	platformevents "nantty/platform/events"
	"nantty/platform/postgres"
)

func TestCatalogRetryBackoffIsExponentialAndBounded(t *testing.T) {
	cases := []struct {
		attempt int
		want    time.Duration
	}{
		{attempt: 1, want: 2 * time.Second},
		{attempt: 2, want: 4 * time.Second},
		{attempt: 10, want: 15 * time.Minute},
		{attempt: 21, want: 15 * time.Minute},
	}
	for _, testCase := range cases {
		if got := retryBackoffAfterAttempts(testCase.attempt); got != testCase.want {
			t.Errorf("retryBackoffAfterAttempts(%d) = %s, want %s", testCase.attempt, got, testCase.want)
		}
	}
}

func TestCatalogOutboxPersistsRetryAndWaitsUntilDue(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test")
	}
	databaseURL := os.Getenv("CATALOG_TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://nantty:nantty@localhost:15432/nantty_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseURL, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable: %v", err)
	}
	schema := fmt.Sprintf("catalog_outbox_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		_ = administrator.Close()
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = administrator.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
		_ = administrator.Close()
	})
	scopedURL, err := postgres.ScopeDatabaseUrlToSchema(databaseURL, schema)
	if err != nil {
		t.Fatal(err)
	}
	if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedURL, migrations.Files, "."); err != nil {
		t.Fatal(err)
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedURL, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatal(err)
	}
	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	t.Cleanup(func() { _ = client.Close() })

	now := time.Date(2026, 11, 3, 16, 0, 0, 0, time.UTC)
	id := uuid.New()
	if err := client.OutboxEvent.Create().SetID(id).SetCreatedAt(now).SetEventType("catalog.testEvent").SetSubject("catalog-test").SetPayload([]byte(`{}`)).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	store := EntOutboxStore{Client: client, Now: func() time.Time { return now }}
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
	row := client.OutboxEvent.Query().Where(outboxevent.IDEQ(id)).OnlyX(ctx)
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
	now = now.Add(2 * time.Second)
	if published, err := store.PublishPendingOutboxEventsInTransaction(ctx, 10, publish); published != 1 || err != nil {
		t.Fatalf("due event should publish: published=%d err=%v", published, err)
	}
	row = client.OutboxEvent.Query().Where(outboxevent.IDEQ(id)).OnlyX(ctx)
	if row.PublishedAt == nil || row.AttemptCount != 1 {
		t.Fatalf("successful retry should publish while preserving failure history: %+v", row)
	}
}

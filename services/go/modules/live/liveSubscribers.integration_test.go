package live

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/src/integrations"
	"zudomart/platform/postgres"
)

func TestStreamStatsCountSubscriptionsStartedDuringTheLive(t *testing.T) {
	harness := startLiveModuleAgainstFreshSchema(t)
	host, other := harness.newUser("host", "creator"), harness.newUser("other", "creator")
	before := harness.clock.Now().Add(-time.Minute)
	harness.subscribers.Subscribe(uuid.New(), host.id, before)
	liveId := harness.goLive(host, nil)
	harness.clock.Advance(time.Second)
	harness.subscribers.Subscribe(uuid.New(), host.id, harness.clock.Now())
	harness.subscribers.Subscribe(uuid.New(), host.id, harness.clock.Now())
	harness.subscribers.Subscribe(uuid.New(), other.id, harness.clock.Now())
	harness.clock.Advance(time.Second)
	harness.expect("POST", "/api/v1/lives/"+liveId+"/end", &host, "", nil, http.StatusNoContent)
	harness.subscribers.Subscribe(uuid.New(), host.id, harness.clock.Now().Add(time.Minute))
	stats := harness.expect("GET", "/api/v1/creators/me/analytics/gifts/streams/"+liveId, &host, "", nil, http.StatusOK)
	if stats["newSubscribers"] != float64(2) {
		t.Fatalf("only subscriptions started during the live count, got %v", stats["newSubscribers"])
	}
}

func TestSchemaCreatorSubscriptionsReadsAccessAndStartsFromTheSubscriptionsSchema(t *testing.T) {
	databaseUrl := os.Getenv("LIVE_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_live_test?sslmode=disable"
	}
	ctx := context.Background()
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("subscriptions_test_%d", time.Now().UnixNano())
	t.Cleanup(func() { dropSchemaAndClose(database, schema) })
	creator, active, lapsed, cancelled, pending := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	now := time.Now()
	statements := []string{
		`CREATE SCHEMA "` + schema + `"`,
		`CREATE TABLE "` + schema + `"."creator_subscriptions" (id uuid PRIMARY KEY, created_at timestamptz NOT NULL, subscriber_id varchar NOT NULL, creator_id varchar NOT NULL, status varchar NOT NULL, current_period_end timestamptz)`,
	}
	for _, statement := range statements {
		if _, err := database.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	insert := func(subscriber uuid.UUID, status string, createdAt time.Time, periodEnd *time.Time) {
		if _, err := database.ExecContext(ctx, `INSERT INTO "`+schema+`"."creator_subscriptions" VALUES ($1, $2, $3, $4, $5, $6)`, uuid.New(), createdAt, subscriber.String(), creator.String(), status, periodEnd); err != nil {
			t.Fatal(err)
		}
	}
	future, past := now.Add(24*time.Hour), now.Add(-time.Hour)
	insert(active, "active", now.Add(-10*time.Minute), &future)
	insert(lapsed, "expired", now.Add(-48*time.Hour), &past)
	insert(cancelled, "cancelled", now.Add(-5*time.Minute), &future)
	insert(pending, "pending", now.Add(-5*time.Minute), nil)
	directory := integrations.SchemaCreatorSubscriptions{Database: database, Schema: schema, Logger: slog.Default()}
	for subscriber, want := range map[uuid.UUID]bool{active: true, cancelled: true, lapsed: false, pending: false, uuid.New(): false} {
		got, err := directory.IsActiveSubscriber(ctx, subscriber, creator)
		if err != nil || got != want {
			t.Fatalf("subscriber %s: got %v %v, want %v", subscriber, got, err, want)
		}
	}
	count, err := directory.CountNewSubscribers(ctx, creator, now.Add(-time.Hour), now)
	if err != nil || count != 2 {
		t.Fatalf("expected the two paid subscriptions started in the window, got %d %v", count, err)
	}
	missing := integrations.SchemaCreatorSubscriptions{Database: database, Schema: schema + "_missing", Logger: slog.Default()}
	if _, err := missing.IsActiveSubscriber(ctx, active, creator); err == nil {
		t.Fatal("an unreadable table must fail closed outside tolerant environments")
	}
	if count, err := missing.CountNewSubscribers(ctx, creator, now.Add(-time.Hour), now); err != nil || count != 0 {
		t.Fatalf("stats degrade to 0 when start times are unreadable, got %d %v", count, err)
	}
}

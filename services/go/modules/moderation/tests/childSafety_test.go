package moderation_test

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	childsafety "nantty/modules/moderation/src/modules/childSafety"
)

type stubMatcher struct{ matched bool }

type trackingReporter struct{ calls int }

func (reporter *trackingReporter) Submit(context.Context, childsafety.StatutoryReport) (string, error) {
	reporter.calls++
	return "test-reference", nil
}

func (m stubMatcher) ProviderName() string { return "photodna-stub" }
func (m stubMatcher) Match(context.Context, childsafety.ScanRequest) (childsafety.MatchVerdict, error) {
	return childsafety.MatchVerdict{Matched: m.matched, Provider: "photodna-stub", Confidence: 99}, nil
}

func TestChildSafetyPipelineFailsClosedWhenUnconfiguredAndQuarantinesMatches(t *testing.T) {
	unconfigured := childsafety.NewPipelineFromEnv(nil)
	sum := childsafety.HashBytesHex([]byte("sample"))
	_, err := unconfigured.ScanAndQuarantine(context.Background(), childsafety.ScanRequest{
		MediaId: "m-1", OwnerId: "u-1", Sha256Hex: sum,
	})
	if err == nil {
		t.Fatal("expected fail-closed error when CSAM scanner is unconfigured")
	}

	pipeline := childsafety.NewPipelineFromEnv(nil)
	pipeline.Matcher = stubMatcher{matched: true}
	verdict, err := pipeline.ScanAndQuarantine(context.Background(), childsafety.ScanRequest{
		MediaId: "m-2", OwnerId: "u-2", Sha256Hex: sum,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !verdict.Matched || !verdict.Quarantined || verdict.ReportStatus != "quarantined_pending_counsel_gate" {
		t.Fatalf("unexpected verdict: %+v", verdict)
	}
	items, err := pipeline.ListQuarantined(context.Background())
	if err != nil || len(items) != 1 {
		t.Fatalf("expected 1 quarantined item, got %d (%v)", len(items), err)
	}
}

func TestChildSafetyReportsOnlyAfterDurableQuarantine(t *testing.T) {
	databaseURL := os.Getenv("MODERATION_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("MODERATION_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "child_safety_test_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE") })
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	parameters := parsed.Query()
	parameters.Set("search_path", schema)
	parsed.RawQuery = parameters.Encode()
	db, err := sql.Open("pgx", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	reporter := &trackingReporter{}
	pipeline := childsafety.NewPipelineFromEnv(db)
	pipeline.Matcher = stubMatcher{matched: true}
	pipeline.Reporter = reporter
	req := childsafety.ScanRequest{MediaId: "test-media", OwnerId: "test-owner", Sha256Hex: childsafety.HashBytesHex([]byte("test"))}
	if _, err := pipeline.ScanAndQuarantine(ctx, req); err == nil || reporter.calls != 0 {
		t.Fatalf("report submitted before quarantine persistence: err=%v calls=%d", err, reporter.calls)
	}
	if _, err := db.ExecContext(ctx,
		`CREATE TABLE child_safety_quarantine (id uuid PRIMARY KEY, media_id text UNIQUE, owner_id text, sha256_hex text, perceptual_hash text, provider text, match_list_id text, confidence integer, status text, report_reference text, detected_at timestamptz, updated_at timestamptz)`); err != nil {
		t.Fatal(err)
	}
	verdict, err := pipeline.ScanAndQuarantine(ctx, req)
	if err != nil || reporter.calls != 1 || verdict.ReportStatus != "reported:test-reference" {
		t.Fatalf("expected report after durable quarantine: verdict=%+v err=%v calls=%d", verdict, err, reporter.calls)
	}
	var status string
	var detectedAt time.Time
	if err := db.QueryRowContext(ctx, `SELECT status, detected_at FROM child_safety_quarantine WHERE media_id = $1`, req.MediaId).Scan(&status, &detectedAt); err != nil || status != "reported:test-reference" || detectedAt.IsZero() {
		t.Fatalf("stored status=%q detectedAt=%v err=%v", status, detectedAt, err)
	}
}

package privacy

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"zudomart/modules/users/src/configs"
	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/migrations"
	exportservices "zudomart/modules/users/src/modules/dataExport/services"
	"zudomart/platform/identityports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
)

type testClock struct {
	mutex  sync.Mutex
	offset time.Duration
}

func (clock *testClock) now() time.Time {
	clock.mutex.Lock()
	defer clock.mutex.Unlock()
	return time.Now().Add(clock.offset)
}

func (clock *testClock) advance(by time.Duration) {
	clock.mutex.Lock()
	clock.offset += by
	clock.mutex.Unlock()
}

type recordedAudit struct {
	mutex  sync.Mutex
	events []identityports.AuditEvent
}

func (recorder *recordedAudit) RecordAuditEvent(_ context.Context, event identityports.AuditEvent) error {
	recorder.mutex.Lock()
	recorder.events = append(recorder.events, event)
	recorder.mutex.Unlock()
	return nil
}

func (recorder *recordedAudit) actions() []string {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	actions := make([]string, 0, len(recorder.events))
	for _, event := range recorder.events {
		actions = append(actions, event.Action)
	}
	return actions
}

type privacyHarness struct {
	t         *testing.T
	server    *httptest.Server
	container *container.Container
	clock     *testClock
	tokens    *identitytest.FakeTokenService
	directory *identitytest.FakeAccountDirectory
	audit     *recordedAudit
}

func startPrivacyHarness(t *testing.T, adjust ...func(*configs.PrivacySettings)) *privacyHarness {
	t.Helper()
	databaseUrl := os.Getenv("USERS_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("users_privacy_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(databaseUrl, schema)
	if err != nil {
		t.Fatal(err)
	}
	if err := postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedUrl, migrations.Files, "."); err != nil {
		t.Fatal(err)
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, scopedUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("AWS_ACCESS_KEY_ID", "test")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "test")
	tokens := identitytest.NewFakeTokenService(t)
	directory := identitytest.NewFakeAccountDirectory()
	audit := &recordedAudit{}
	identityports.Default.RegisterAccountDirectory(directory)
	identityports.Default.RegisterStaffTokenService(tokens)
	identityports.Default.RegisterAuditRecorder(audit)
	clock := &testClock{}
	privacy := configs.PrivacySettings{
		ExportBucket: "zudomart-exports-test", ExportObjectEndpoint: "http://localhost:18333", ExportRegion: "eu-west-1",
		ExportDownloadLinkTtl: 5 * time.Minute, ExportArchiveTtl: 72 * time.Hour, ExportWorkerPollInterval: time.Hour, DeletionGraceDays: 30,
		DeletionWorkerPollInterval: time.Hour, InternalApiToken: "internal-secret-token-for-tests", AnonymousConsentPerMinute: 1000,
	}
	for _, change := range adjust {
		change(&privacy)
	}
	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	t.Cleanup(func() { _ = client.Close() })
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, identitytest.FakeAccountAudience)
	c := &container.Container{
		Client: client, Settings: configs.UsersSettings{Privacy: privacy}, Now: clock.now, AccessVerifier: verifier,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	if err := SeedReferenceData(ctx, c); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	Mount(mux, c)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return &privacyHarness{t: t, server: server, container: c, clock: clock, tokens: tokens, directory: directory, audit: audit}
}

func dropSchemaAndClose(administrator *sql.DB, schema string) {
	_, _ = administrator.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
	_ = administrator.Close()
}

func (harness *privacyHarness) newAccount(username string) (accountId uuid.UUID, token string) {
	summary := harness.directory.AddAccount(username, "Test "+username)
	return summary.ID, harness.tokens.SignAccountAccessToken(harness.t, summary.ID.String())
}

func (harness *privacyHarness) send(method, path, token string, headers map[string]string, body any) (int, map[string]any, http.Header) {
	harness.t.Helper()
	var reader io.Reader = http.NoBody
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, reader)
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded, response.Header
}

func (harness *privacyHarness) expect(method, path, token string, body any, wantStatus int) map[string]any {
	harness.t.Helper()
	status, decoded, _ := harness.send(method, path, token, nil, body)
	if status != wantStatus {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

func (harness *privacyHarness) expectWithHeaders(method, path, token string, headers map[string]string, body any, wantStatus int) map[string]any {
	harness.t.Helper()
	status, decoded, _ := harness.send(method, path, token, headers, body)
	if status != wantStatus {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

func (harness *privacyHarness) outboxEventTypes() []string {
	harness.t.Helper()
	rows, err := harness.container.Client.OutboxEvent.Query().All(context.Background())
	if err != nil {
		harness.t.Fatal(err)
	}
	types := make([]string, 0, len(rows))
	for _, row := range rows {
		types = append(types, row.EventType)
	}
	return types
}

func countOf(values []string, wanted string) int {
	count := 0
	for _, value := range values {
		if value == wanted {
			count++
		}
	}
	return count
}

func objectStorageIsWritable(harness *privacyHarness) bool {
	connection, err := net.DialTimeout("tcp", "localhost:18333", time.Second)
	if err != nil {
		return false
	}
	_ = connection.Close()
	store, err := exportservices.ObjectStoreFor(context.Background(), harness.container.Settings.Privacy)
	if err != nil {
		return false
	}
	probeContext, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	if store.Put(probeContext, "probe/writable.txt", []byte("ok"), "text/plain") != nil {
		return false
	}
	_ = store.Delete(probeContext, "probe/writable.txt")
	return true
}

func listItems(t *testing.T, body map[string]any) []map[string]any {
	t.Helper()
	raw, ok := body["data"].([]any)
	if !ok {
		t.Fatalf("response is not a list envelope: %v", body)
	}
	items := make([]map[string]any, 0, len(raw))
	for _, entry := range raw {
		items = append(items, entry.(map[string]any))
	}
	if _, hasCursor := body["nextCursor"]; !hasCursor {
		t.Fatalf("list envelope is missing nextCursor: %v", body)
	}
	return items
}

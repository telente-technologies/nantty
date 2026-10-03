package users

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/users/src/configs"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/identityports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type usersTestHarness struct {
	t         *testing.T
	server    *httptest.Server
	publisher *events.RecordingPublisher
	tokens    *identitytest.FakeTokenService
	accounts  *identitytest.FakeAccountDirectory
	audit     *recordingAuditRecorder
	settings  *fixedPlatformSettings
}

type recordingAuditRecorder struct {
	actions []string
}

func (recorder *recordingAuditRecorder) RecordAuditEvent(_ context.Context, event identityports.AuditEvent) error {
	recorder.actions = append(recorder.actions, event.Action)
	return nil
}

type fixedPlatformSettings struct {
	creatorRequirements string
}

func (settings *fixedPlatformSettings) ReadSettingValue(_ context.Context, key string) (json.RawMessage, int, error) {
	if key == "creator.requirements" {
		return json.RawMessage(settings.creatorRequirements), 1, nil
	}
	return nil, 0, identityports.ErrSettingNotFound
}

func startUsersModuleAgainstFreshSchema(t *testing.T) *usersTestHarness {
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
	schema := fmt.Sprintf("users_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	harness := &usersTestHarness{
		t: t, publisher: &events.RecordingPublisher{}, tokens: identitytest.NewFakeTokenService(t), accounts: identitytest.NewFakeAccountDirectory(),
		audit: &recordingAuditRecorder{}, settings: &fixedPlatformSettings{creatorRequirements: `{"minimumAccountAgeDays":30}`},
	}
	identityports.Default.RegisterStaffTokenService(harness.tokens)
	identityports.Default.RegisterAccountDirectory(harness.accounts)
	identityports.Default.RegisterAccountEnforcement(harness.accounts)
	identityports.Default.RegisterAuditRecorder(harness.audit)
	identityports.Default.RegisterPlatformSettings(harness.settings)
	settings := configs.UsersSettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, TokenIssuer: identitytest.FakeIssuer, TokenAudience: identitytest.FakeAccountAudience,
		UsernameChangeCooldown: 30 * 24 * time.Hour, UsernameMaximumChangesYear: 3, UsernameQuarantine: 120 * 24 * time.Hour,
		MediaPublicBaseUrl: "https://media.zudomart.test", MediaUploadBaseUrl: "https://upload.zudomart.test", MediaUploadSigningKey: bytes.Repeat([]byte{3}, 32), MediaUploadIntentTimeToLive: 10 * time.Minute,
		Privacy: configs.PrivacySettings{
			ExportBucket: "users-test-exports", ExportRegion: "eu-west-1", ExportDownloadLinkTtl: time.Minute, ExportArchiveTtl: time.Hour,
			ExportWorkerPollInterval: time.Hour, DeletionGraceDays: 14, DeletionWorkerPollInterval: time.Hour, AnonymousConsentPerMinute: 60, InternalApiToken: strings.Repeat("u", 32), DocumentsBucket: "users-test-documents",
		},
	}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)), Health: health.NewRegistryForService("users-test")}
	module, err := StartUsersModuleWithSettings(ctx, settings, harness.publisher, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	workerContext, stopWorkers := context.WithCancel(ctx)
	go func() { _ = module.RunBackgroundWorkersUntilContextDone(workerContext) }()
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	harness.server = httptest.NewServer(mux)
	t.Cleanup(func() { harness.server.Close(); stopWorkers(); _ = module.Close(ctx) })
	return harness
}

func dropSchemaAndClose(administrator *sql.DB, schema string) {
	_, _ = administrator.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
	_ = administrator.Close()
}

func (harness *usersTestHarness) call(method, path, accessToken string, body any, extraHeaders ...string) (int, map[string]any) {
	harness.t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, reader)
	request.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	for index := 0; index+1 < len(extraHeaders); index += 2 {
		request.Header.Set(extraHeaders[index], extraHeaders[index+1])
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func (harness *usersTestHarness) expect(method, path, accessToken string, body any, wantStatus int, extraHeaders ...string) map[string]any {
	harness.t.Helper()
	status, decoded := harness.call(method, path, accessToken, body, extraHeaders...)
	if status != wantStatus {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

func (harness *usersTestHarness) newAccount(username, name string) (string, string) {
	account := harness.accounts.AddAccount(username, name)
	return account.ID.String(), harness.tokens.SignAccountAccessToken(harness.t, account.ID.String())
}

func (harness *usersTestHarness) staffHeaders(permissions ...string) (string, []string) {
	accessToken, stepUpToken, _ := harness.tokens.SignStaffTokensForTest(harness.t, "admin", permissions)
	return accessToken, []string{"X-Step-Up-Token", stepUpToken}
}

func (harness *usersTestHarness) waitForPublishedEvents(wanted ...string) {
	harness.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		published := strings.Join(harness.publisher.PublishedEventTypes(), ",")
		missing := false
		for _, eventType := range wanted {
			missing = missing || !strings.Contains(published, eventType)
		}
		if !missing {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	harness.t.Fatalf("events not published: want %v, got %v", wanted, harness.publisher.PublishedEventTypes())
}

func mustParseUuid(value string) uuid.UUID {
	parsed, err := uuid.Parse(value)
	if err != nil {
		panic(err)
	}
	return parsed
}

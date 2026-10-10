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
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"zudomart/modules/users/src/configs"
	checkmarkservices "zudomart/modules/users/src/modules/checkmarks/services"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/identityports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

type usersTestHarness struct {
	t            *testing.T
	server       *httptest.Server
	publisher    *events.RecordingPublisher
	tokens       *identitytest.FakeTokenService
	accounts     *identitytest.FakeAccountDirectory
	audit        *recordingAuditRecorder
	settings     *fixedPlatformSettings
	databaseUrl  string
	moneyBlocked *atomic.Bool
	module       *Module
	schema       string
}

type recordingAuditRecorder struct {
	mutex   sync.Mutex
	actions []string
}

func (recorder *recordingAuditRecorder) RecordAuditEvent(_ context.Context, event identityports.AuditEvent) error {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	recorder.actions = append(recorder.actions, event.Action)
	return nil
}

type fixedPlatformSettings struct {
	creatorRequirements string
	usernameRules       string
}

func (settings *fixedPlatformSettings) ReadSettingValue(_ context.Context, key string) (json.RawMessage, int, error) {
	if key == "creator.requirements" {
		return json.RawMessage(settings.creatorRequirements), 1, nil
	}
	if key == "username-rules" && settings.usernameRules != "" {
		return json.RawMessage(settings.usernameRules), 1, nil
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
	moneyBlocked := &atomic.Bool{}
	moneyServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-Internal-Token") != strings.Repeat("m", 32) {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = writer.Write([]byte(fmt.Sprintf(`{"pendingWithdrawals":%d,"nonZeroBalances":[],"canDelete":%t}`, map[bool]int{true: 1, false: 0}[moneyBlocked.Load()], !moneyBlocked.Load())))
	}))
	t.Cleanup(moneyServer.Close)
	harness := &usersTestHarness{moneyBlocked: moneyBlocked,
		t: t, publisher: &events.RecordingPublisher{}, tokens: identitytest.NewFakeTokenService(t), accounts: identitytest.NewFakeAccountDirectory(),
		audit: &recordingAuditRecorder{}, settings: &fixedPlatformSettings{creatorRequirements: `{"minimumAccountAgeDays":30}`}, databaseUrl: databaseUrl, schema: schema,
	}
	identityports.Default.RegisterStaffTokenService(harness.tokens)
	identityports.Default.RegisterStaffSessionChecker(identitytest.ActiveStaffSessionChecker{})
	identityports.Default.RegisterStaffNetworkPolicy(identitytest.PermissiveStaffNetworkPolicy{})
	identityports.Default.RegisterAccountDirectory(harness.accounts)
	identityports.Default.RegisterAccountEnforcement(harness.accounts)
	identityports.Default.RegisterCurrencyResolver(fixedCurrencies{})
	identityports.Default.RegisterAuditRecorder(harness.audit)
	identityports.Default.RegisterPlatformSettings(harness.settings)
	settings := configs.UsersSettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, TokenIssuer: identitytest.FakeIssuer, TokenAudience: identitytest.FakeAccountAudience,
		UsernameChangeCooldown: 30 * 24 * time.Hour, UsernameMaximumChangesYear: 3, UsernameQuarantine: 120 * 24 * time.Hour,
		CatalogSchema:      schema + "_catalog",
		MediaPublicBaseUrl: "https://media.zudomart.test", MediaUploadBaseUrl: "https://upload.zudomart.test", MediaUploadSigningKey: bytes.Repeat([]byte{3}, 32), MediaUploadIntentTimeToLive: 10 * time.Minute,
		AddressPhoneKey: bytes.Repeat([]byte{4}, 32),
		Privacy: configs.PrivacySettings{
			ExportBucket: "users-test-exports", ExportRegion: "eu-west-1", ExportDownloadLinkTtl: time.Minute, ExportArchiveTtl: time.Hour,
			ExportWorkerPollInterval: time.Hour, DeletionGraceDays: 14, DeletionWorkerPollInterval: 200 * time.Millisecond, AnonymousConsentPerMinute: 60, InternalApiToken: strings.Repeat("u", 32), MoneyInternalUrl: moneyServer.URL, MoneyInternalToken: strings.Repeat("m", 32), DocumentsBucket: "users-test-documents",
		},
	}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)), Health: health.NewRegistryForService("users-test")}
	module, err := StartUsersModuleWithSettings(ctx, settings, harness.publisher, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	harness.module = module
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

func (recorder *recordingAuditRecorder) has(action string) bool {
	recorder.mutex.Lock()
	defer recorder.mutex.Unlock()
	for _, recorded := range recorder.actions {
		if recorded == action {
			return true
		}
	}
	return false
}

func (harness *usersTestHarness) execSql(statement string, arguments ...any) {
	harness.t.Helper()
	scoped, err := postgres.ScopeDatabaseUrlToSchema(harness.databaseUrl, harness.schema)
	if err != nil {
		harness.t.Fatal(err)
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(context.Background(), scoped, postgres.DefaultPoolSettings())
	if err != nil {
		harness.t.Fatal(err)
	}
	defer database.Close()
	if _, err := database.Exec(statement, arguments...); err != nil {
		harness.t.Fatal(err)
	}
}

func (harness *usersTestHarness) staff(role string, permissions ...string) (string, []string) {
	accessToken, stepUpToken, _ := harness.tokens.SignStaffTokensForTest(harness.t, role, permissions)
	return accessToken, []string{"X-Step-Up-Token", stepUpToken}
}

func (harness *usersTestHarness) waitUntil(condition func() bool) bool {
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return true
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}

func (harness *usersTestHarness) runSuggestionScheduler() {
	harness.t.Helper()
	if err := (checkmarkservices.SuggestionScheduler{Container: harness.module.Container()}).RunOnce(context.Background()); err != nil {
		harness.t.Fatal(err)
	}
	time.Sleep(300 * time.Millisecond)
}

type fixedCurrencies struct{}

func (fixedCurrencies) CurrencyForCountry(countryCode string) (string, bool) {
	return "NGN", countryCode == "NG"
}

package moderation

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"zudomart/modules/moderation/src"
	"zudomart/modules/moderation/src/configs"
	"zudomart/modules/moderation/src/integrations"
	"zudomart/modules/moderation/src/middlewares"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffauth"
)

type fakeUsers struct {
	mutex    sync.Mutex
	Requests []integrations.EnforcementRequest
}

func (users *fakeUsers) Enforce(_ context.Context, request integrations.EnforcementRequest) error {
	users.mutex.Lock()
	defer users.mutex.Unlock()
	users.Requests = append(users.Requests, request)
	return nil
}

func (users *fakeUsers) Summaries(_ context.Context, ids []uuid.UUID) (map[string]integrations.UserSummary, error) {
	summaries := map[string]integrations.UserSummary{}
	for _, identifier := range ids {
		summaries[identifier.String()] = integrations.UserSummary{"id": identifier.String(), "username": "user-" + identifier.String()[:6]}
	}
	return summaries, nil
}

func (users *fakeUsers) last() integrations.EnforcementRequest {
	users.mutex.Lock()
	defer users.mutex.Unlock()
	return users.Requests[len(users.Requests)-1]
}

type fakeAudit struct {
	mutex   sync.Mutex
	Actions []string
}

func (audit *fakeAudit) Record(_ context.Context, record integrations.AuditRecord) error {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	audit.Actions = append(audit.Actions, record.Action)
	return nil
}

func (audit *fakeAudit) History(context.Context, string, string) ([]json.RawMessage, error) {
	return []json.RawMessage{}, nil
}

func (audit *fakeAudit) has(action string) bool {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	for _, recorded := range audit.Actions {
		if recorded == action {
			return true
		}
	}
	return false
}

type moderationHarness struct {
	t         *testing.T
	server    *httptest.Server
	module    *src.Module
	tokens    *identitytest.FakeTokenService
	users     *fakeUsers
	audit     *fakeAudit
	publisher *events.RecordingPublisher
	targets   *fakeTargets
	database  *sql.DB
	schema    string
}

func startModerationAgainstFreshSchema(t *testing.T) *moderationHarness {
	t.Helper()
	databaseUrl := os.Getenv("MODERATION_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("moderation_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = administrator.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
		_ = administrator.Close()
	})
	tokens := identitytest.NewFakeTokenService(t)
	verifier := func(audience string) *jwtauth.AccessTokenVerifier {
		return jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, audience)
	}
	staffVerifiers := middlewares.StaffTokenVerifiers{Access: verifier(staffauth.AccessAudience), StepUp: verifier(staffauth.StepUpAudience)}
	accessVerifier := verifier(identitytest.FakeAccountAudience)
	settings := configs.ModerationSettings{Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, ReportsPerHour: 5, IntakeToken: strings.Repeat("m", 32)}
	harness := &moderationHarness{t: t, tokens: tokens, users: &fakeUsers{}, audit: &fakeAudit{}, publisher: &events.RecordingPublisher{}, targets: &fakeTargets{owners: map[string]string{}}, schema: schema}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)), Health: health.NewRegistryForService("moderation-test")}
	module, err := src.StartModerationModuleWithSettings(ctx, settings, harness.publisher, dependencies, src.Overrides{AccessVerifier: accessVerifier, StaffVerifiers: &staffVerifiers, Users: harness.users, Audit: harness.audit, Targets: harness.targets})
	if err != nil {
		t.Fatal(err)
	}
	workerContext, stopWorkers := context.WithCancel(ctx)
	go func() { _ = module.RunBackgroundWorkersUntilContextDone(workerContext) }()
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	harness.server, harness.module = httptest.NewServer(mux), module
	scoped, _ := postgres.ScopeDatabaseUrlToSchema(databaseUrl, schema)
	harness.database, _ = postgres.OpenDatabaseAndVerifyConnection(ctx, scoped, postgres.DefaultPoolSettings())
	t.Cleanup(func() { harness.server.Close(); stopWorkers(); _ = harness.database.Close(); _ = module.Close(ctx) })
	return harness
}

func (harness *moderationHarness) call(method, path, token string, body any, headers ...string) (int, map[string]any, http.Header) {
	harness.t.Helper()
	encoded, _ := json.Marshal(body)
	if body == nil {
		encoded = nil
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	for index := 0; index+1 < len(headers); index += 2 {
		request.Header.Set(headers[index], headers[index+1])
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

func (harness *moderationHarness) expect(method, path, token string, body any, want int, headers ...string) map[string]any {
	harness.t.Helper()
	status, decoded, _ := harness.call(method, path, token, body, headers...)
	if status != want {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, want)
	}
	return decoded
}

func (harness *moderationHarness) staff(permissions ...string) (string, []string) {
	access, stepUp, _ := harness.tokens.SignStaffTokensForTest(harness.t, "admin", permissions)
	return access, []string{"X-Step-Up-Token", stepUp}
}

func (harness *moderationHarness) reporter() (string, string) {
	identifier := uuid.NewString()
	return identifier, harness.tokens.SignAccountAccessToken(harness.t, identifier)
}

func evidenceFor(reportedUserId string, count int) (json.RawMessage, string) {
	messages := make([]map[string]any, 0, count)
	for index := range count {
		messages = append(messages, map[string]any{"messageId": fmt.Sprintf("m%d", index), "senderId": reportedUserId, "senderName": "Rude Sender", "sentAt": "2026-10-03T10:00:00.000Z", "text": "pay me now", "attachments": []any{}})
	}
	raw, _ := json.Marshal(messages)
	digest := sha256.Sum256(raw)
	return raw, hex.EncodeToString(digest[:])
}

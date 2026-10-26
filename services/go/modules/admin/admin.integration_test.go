package admin

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base32"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/jackc/pgx/v5"

	"nantty/modules/admin/src/configs"
	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	bootstrapsuperadmin "nantty/modules/admin/src/modules/staffAdmins/commands/bootstrapSuperadmin"
	"nantty/modules/admin/src/utils/totp"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/identityports"
	"nantty/platform/identityports/identitytest"
	"nantty/platform/passwordhash"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
)

const strongPassword = "Correct-Horse-Battery-7"

type lockedBuffer struct {
	mutex  sync.Mutex
	buffer bytes.Buffer
}

func (locked *lockedBuffer) Write(chunk []byte) (int, error) {
	locked.mutex.Lock()
	defer locked.mutex.Unlock()
	return locked.buffer.Write(chunk)
}

func (locked *lockedBuffer) String() string {
	locked.mutex.Lock()
	defer locked.mutex.Unlock()
	return locked.buffer.String()
}

type adminHarness struct {
	t         *testing.T
	server    *httptest.Server
	logs      *lockedBuffer
	publisher *events.RecordingPublisher
	fakeToken *identitytest.FakeTokenService
	seeder    *container.Container
	settings  configs.AdminSettings
}

func startAdminModuleAgainstFreshSchema(t *testing.T) *adminHarness {
	t.Helper()
	databaseUrl := os.Getenv("ADMIN_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("admin_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	fakeToken := identitytest.NewFakeTokenService(t)
	identityports.Default.RegisterStaffTokenService(fakeToken)
	settings := configs.AdminSettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, TotpEncryptionKey: bytes.Repeat([]byte{3}, 32), TotpIssuerLabel: "Zudomart",
		StaffRefreshTokenTtl: 12 * time.Hour, InvitationTtl: 72 * time.Hour, StepUpTtl: 5 * time.Minute, LoginChallengeTtl: 5 * time.Minute,
		MaximumFailedPasswords: 5, LockoutDuration: 15 * time.Minute, InternalApiToken: strings.Repeat("i", 32), DeliveryMode: "log",
		WebAuthn: configs.WebAuthnSettings{RelyingPartyId: "localhost", RelyingPartyName: "Zudomart Admin", Origins: []string{"http://localhost:3400"}},
	}
	logs, publisher := &lockedBuffer{}, &events.RecordingPublisher{}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(logs, nil)), Health: health.NewRegistryForService("admin-test")}
	module, err := StartAdminModuleWithSettings(ctx, settings, publisher, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	workerContext, stopWorkers := context.WithCancel(ctx)
	go func() { _ = module.RunBackgroundWorkersUntilContextDone(workerContext) }()
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	server := httptest.NewServer(mux)
	t.Cleanup(func() { server.Close(); stopWorkers(); _ = module.Close(ctx) })
	return &adminHarness{t: t, server: server, logs: logs, publisher: publisher, fakeToken: fakeToken, seeder: openSeedingContainer(t, settings), settings: settings}
}

func openSeedingContainer(t *testing.T, settings configs.AdminSettings) *container.Container {
	scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(settings.DatabaseUrl, settings.DatabaseSchema)
	if err != nil {
		t.Fatal(err)
	}
	database, err := postgres.OpenDatabaseAndVerifyConnection(context.Background(), scopedUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Fatal(err)
	}
	client := ent.NewClient(ent.Driver(entsql.OpenDB(dialect.Postgres, database)))
	t.Cleanup(func() { _ = client.Close() })
	return &container.Container{Client: client, Now: time.Now, Settings: settings, Passwords: passwordhash.NewPasswordHasher(passwordhash.Argon2idParameters{MemoryKibibytes: 1024, Iterations: 1, Parallelism: 1, SaltLength: 16, KeyLength: 32})}
}

func dropSchemaAndClose(administrator *sql.DB, schema string) {
	_, _ = administrator.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
	_ = administrator.Close()
}

func (harness *adminHarness) bootstrapSuperadmin(email string) {
	harness.t.Helper()
	_, err := bootstrapsuperadmin.Handler{Container: harness.seeder}.Execute(context.Background(), bootstrapsuperadmin.Command{Email: email, DisplayName: "Root", Password: strongPassword})
	if err != nil {
		harness.t.Fatal(err)
	}
}

type response struct {
	status  int
	body    map[string]any
	headers http.Header
	raw     []byte
}

func (harness *adminHarness) call(method, path string, body any, headers map[string]string) response {
	harness.t.Helper()
	encoded, _ := json.Marshal(body)
	if body == nil {
		encoded = nil
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	httpResponse, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer httpResponse.Body.Close()
	var raw bytes.Buffer
	_, _ = raw.ReadFrom(httpResponse.Body)
	decoded := map[string]any{}
	_ = json.Unmarshal(raw.Bytes(), &decoded)
	return response{status: httpResponse.StatusCode, body: decoded, headers: httpResponse.Header, raw: raw.Bytes()}
}

func (harness *adminHarness) expect(method, path string, body any, headers map[string]string, wantStatus int) map[string]any {
	harness.t.Helper()
	result := harness.call(method, path, body, headers)
	if result.status != wantStatus {
		harness.t.Fatalf("%s %s = %d %s, want %d", method, path, result.status, result.raw, wantStatus)
	}
	return result.body
}

func bearer(token string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token}
}

func bearerWithStepUp(token, stepUp string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token, "X-Step-Up-Token": stepUp}
}

func waitForNextTotpStep() {
	current := totp.StepAt(time.Now())
	for totp.StepAt(time.Now()) == current {
		time.Sleep(200 * time.Millisecond)
	}
}

func codeForStepOffset(t *testing.T, base32Secret string, offset int64) string {
	t.Helper()
	secret, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(base32Secret)
	if err != nil {
		t.Fatal(err)
	}
	return totp.ComputeCode(secret, totp.StepAt(time.Now())+offset, totp.DefaultDigits)
}

func (harness *adminHarness) lastLoggedInvitationToken() string {
	matches := regexp.MustCompile(`token ([A-Za-z0-9_-]+)`).FindAllStringSubmatch(harness.logs.String(), -1)
	if len(matches) == 0 {
		harness.t.Fatal("no invitation was delivered")
	}
	return matches[len(matches)-1][1]
}

func (harness *adminHarness) enrollAndSignIn(email, password string) (session map[string]any, secret string) {
	harness.t.Helper()
	challenge := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": email, "password": password}, nil, http.StatusOK)
	if challenge["status"] != "mfa_enrollment_required" {
		harness.t.Fatalf("unexpected challenge %v", challenge)
	}
	token := challenge["challengeToken"].(string)
	secret = harness.expect("POST", "/api/v1/admin/auth/mfa/enroll/start", map[string]string{"challengeToken": token}, nil, http.StatusOK)["secret"].(string)
	session = harness.expect("POST", "/api/v1/admin/auth/mfa/enroll/confirm", map[string]string{"challengeToken": token, "code": codeForStepOffset(harness.t, secret, -1)}, nil, http.StatusOK)
	return session, secret
}

func (harness *adminHarness) signInWithMfa(email, password, secret string, offset int64) map[string]any {
	harness.t.Helper()
	challenge := harness.expect("POST", "/api/v1/admin/auth/login", map[string]string{"email": email, "password": password}, nil, http.StatusOK)
	if challenge["status"] != "mfa_required" {
		harness.t.Fatalf("unexpected challenge %v", challenge)
	}
	return harness.expect("POST", "/api/v1/admin/auth/mfa/verify", map[string]string{"challengeToken": challenge["challengeToken"].(string), "code": codeForStepOffset(harness.t, secret, offset)}, nil, http.StatusOK)
}

func (harness *adminHarness) grantStepUp(accessToken, secret string, offset int64) string {
	harness.t.Helper()
	return harness.expect("POST", "/api/v1/admin/auth/step-up", map[string]string{"code": codeForStepOffset(harness.t, secret, offset)}, bearer(accessToken), http.StatusOK)["stepUpToken"].(string)
}

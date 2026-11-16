package auth_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	auth "nantty/modules/auth"
	"nantty/modules/auth/src/configs"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
)

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

type authTestHarness struct {
	t         *testing.T
	server    *httptest.Server
	logs      *lockedBuffer
	publisher *events.RecordingPublisher
	settings  configs.AuthSettings
	clientIp  string
}

var harnessClientIpCounter atomic.Int64

func startAuthModuleAgainstFreshSchema(t *testing.T, adjustments ...func(*configs.AuthSettings)) *authTestHarness {
	t.Helper()
	databaseUrl := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://nantty:nantty@localhost:15432/nantty_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("auth_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	settings := configs.AuthSettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema,
		TokenIssuer: "https://auth.nantty.test", TokenAudience: "nantty-api",
		AccessTokenTimeToLive: 15 * time.Minute, RefreshTokenTimeToLive: 24 * time.Hour, SessionMaximumLifetime: 48 * time.Hour,
		SigningKeyRotationInterval: 24 * time.Hour, SigningKeyEncryptionKey: bytes.Repeat([]byte{1}, 32), OneTimeCodePepper: bytes.Repeat([]byte{2}, 32),
		OneTimeCodeTimeToLive: 5 * time.Minute, OneTimeCodeMaximumAttempts: 5, OneTimeCodeResendCooldown: time.Minute, VerifiedDestinationTokenTtl: 15 * time.Minute,
		StaffAccessTokenTimeToLive: 10 * time.Minute,
	}
	for _, adjust := range adjustments {
		adjust(&settings)
	}
	logs := &lockedBuffer{}
	publisher := &events.RecordingPublisher{}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(logs, nil)), Health: health.NewRegistryForService("auth-test")}
	module, err := auth.StartAuthModuleWithSettings(ctx, settings, publisher, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	workerContext, stopWorkers := context.WithCancel(ctx)
	go func() { _ = module.RunBackgroundWorkersUntilContextDone(workerContext) }()
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	server := httptest.NewServer(mux)
	t.Cleanup(func() { server.Close(); stopWorkers(); _ = module.Close(ctx) })
	next := harnessClientIpCounter.Add(1)
	clientIp := fmt.Sprintf("198.18.%d.%d", (next/250)%256, 1+next%250)
	return &authTestHarness{t: t, server: server, logs: logs, publisher: publisher, settings: settings, clientIp: clientIp}
}

func dropSchemaAndClose(administrator *sql.DB, schema string) {
	_, _ = administrator.Exec("DROP SCHEMA " + pgx.Identifier{schema}.Sanitize() + " CASCADE")
	_ = administrator.Close()
}

func (harness *authTestHarness) call(method, path, accessToken string, body any) (int, map[string]any) {
	return harness.callWithHeaders(method, path, accessToken, body, nil)
}

func (harness *authTestHarness) callWithHeaders(method, path, accessToken string, body any, headers map[string]string) (int, map[string]any) {
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
	if harness.clientIp != "" {
		request.Header.Set("X-Forwarded-For", harness.clientIp)
	}
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
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
	return response.StatusCode, decoded
}

func (harness *authTestHarness) expect(method, path, accessToken string, body any, wantStatus int) map[string]any {
	return harness.expectWithHeaders(method, path, accessToken, body, nil, wantStatus)
}

func (harness *authTestHarness) expectWithHeaders(method, path, accessToken string, body any, headers map[string]string, wantStatus int) map[string]any {
	harness.t.Helper()
	status, decoded := harness.callWithHeaders(method, path, accessToken, body, headers)
	if status != wantStatus {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

func (harness *authTestHarness) lastLoggedOneTimeCode() string {
	matches := regexp.MustCompile(`passcode for \S+ is (\d{6})`).FindAllStringSubmatch(harness.logs.String(), -1)
	if len(matches) == 0 {
		harness.t.Fatal("no one-time code was delivered")
	}
	return matches[len(matches)-1][1]
}

func wrongCodeFor(code string) string {
	if code == "000000" {
		return "111111"
	}
	return "000000"
}

func TestRegisterLoginRefreshRotationReuseDetectionAndLogout(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "Ada.Lovelace@Example.com"
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	code := harness.lastLoggedOneTimeCode()
	wrong := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": wrongCodeFor(code), "purpose": "signup"}, http.StatusBadRequest)
	if wrong["code"] != "INVALID_CODE" {
		t.Fatalf("unexpected error %v", wrong)
	}
	otpToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": code, "purpose": "signup"}, http.StatusOK)["otpToken"].(string)

	registration := map[string]string{"email": email, "birthday": "1995-12-10", "password": "analytical1", "otpToken": otpToken}
	registered := harness.expect("POST", "/api/v1/auth/register", "", registration, http.StatusCreated)
	user := registered["user"].(map[string]any)
	if user["email"] != "ada.lovelace@example.com" || registered["isNewUser"] != true || registered["tokenType"] != "Bearer" {
		t.Fatalf("unexpected registration %v", registered)
	}
	harness.expect("POST", "/api/v1/auth/register", "", registration, http.StatusBadRequest)
	availability := harness.expect("GET", "/api/v1/auth/username-available?username="+user["username"].(string), "", nil, http.StatusOK)
	if availability["available"] != false {
		t.Fatalf("registered username should be taken: %v", availability)
	}

	harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "wrong-password1"}, http.StatusUnauthorized)
	loggedIn := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": user["username"].(string), "password": "analytical1"}, http.StatusOK)

	firstRefresh := loggedIn["refreshToken"].(string)
	rotated := harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": firstRefresh}, http.StatusOK)
	if rotated["refreshToken"] == firstRefresh {
		t.Fatal("refresh token must rotate")
	}
	reuse := harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": firstRefresh}, http.StatusUnauthorized)
	if reuse["code"] != "REFRESH_TOKEN_REUSED" {
		t.Fatalf("expected reuse detection, got %v", reuse)
	}
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": rotated["refreshToken"].(string)}, http.StatusUnauthorized)

	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(context.Background(), harness.server.URL+"/.well-known/jwks.json", harness.settings.TokenIssuer, harness.settings.TokenAudience)
	if err != nil {
		t.Fatal(err)
	}
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(context.Background(), registered["accessToken"].(string))
	if err != nil || principal.UserId != user["id"] {
		t.Fatalf("access token did not verify through JWKS: %v %+v", err, principal)
	}

	harness.expect("POST", "/api/v1/auth/logout", "", map[string]any{"refreshToken": nil}, http.StatusUnauthorized)
	harness.expect("POST", "/api/v1/auth/logout", registered["accessToken"].(string), map[string]any{"refreshToken": registered["refreshToken"]}, http.StatusNoContent)
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": registered["refreshToken"].(string)}, http.StatusUnauthorized)

	waitForPublishedEventTypes(t, harness.publisher, "account.registered", "account.loggedIn", "session.refreshTokenReuseDetected")
}

func TestSignupCodeLocksAfterFiveWrongAttempts(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "grace@example.com"
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	wrong := wrongCodeFor(harness.lastLoggedOneTimeCode())
	statuses := []int{400, 400, 400, 400, 429, 400}
	for attempt, want := range statuses {
		status, body := harness.call("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": wrong, "purpose": "signup"})
		if status != want {
			t.Fatalf("attempt %d: status %d %v, want %d", attempt+1, status, body, want)
		}
	}
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": "nobody@example.com", "purpose": "reset"}, http.StatusOK)
	if strings.Contains(harness.logs.String(), "nobody@example.com is") {
		t.Fatal("reset codes must not be sent to unknown accounts")
	}
}

func TestOneTimeCodeSendsPerDestinationAreCapped(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) {
		settings.OneTimeCodeResendCooldown = 0
		settings.OneTimeCodeMaximumSendsPerHour = 2
	})
	email := "capped@example.com"
	for range 3 {
		harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	}
	delivered := regexp.MustCompile(`passcode for capped@example\.com is \d{6}`).FindAllString(harness.logs.String(), -1)
	if len(delivered) != 2 {
		t.Fatalf("want two delivered codes before the hourly cap, got %d", len(delivered))
	}
}

func waitForPublishedEventTypes(t *testing.T, publisher *events.RecordingPublisher, wanted ...string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		published := strings.Join(publisher.PublishedEventTypes(), ",")
		missing := false
		for _, eventType := range wanted {
			missing = missing || !strings.Contains(published, eventType)
		}
		if !missing {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("events not published: want %v, got %v", wanted, publisher.PublishedEventTypes())
}

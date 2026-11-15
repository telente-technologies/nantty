package live_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	live "nantty/modules/live"
	"nantty/modules/live/src/configs"
	"nantty/modules/live/src/integrations"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
)

const (
	testIssuer        = "https://auth.nantty.test"
	testAudience      = "nantty-api"
	testSecret        = "secret-only-for-local-development-0001"
	testInternalToken = "internal-token-only-for-live-tests-0123"
)

type fakeClock struct {
	mutex   sync.Mutex
	current time.Time
}

func (clock *fakeClock) Now() time.Time {
	clock.mutex.Lock()
	defer clock.mutex.Unlock()
	return clock.current
}

func (clock *fakeClock) Advance(amount time.Duration) {
	clock.mutex.Lock()
	defer clock.mutex.Unlock()
	clock.current = clock.current.Add(amount)
}

type liveHarness struct {
	t           *testing.T
	server      *httptest.Server
	module      *live.Module
	money       *integrations.InMemoryMoneyGateway
	directory   *integrations.InMemoryParticipantDirectory
	publisher   *events.RecordingPublisher
	clock       *fakeClock
	signer      jwk.Key
	relations   *integrations.InMemorySocialRelations
	catalog     *integrations.InMemoryStoreCatalog
	subscribers *integrations.InMemoryCreatorSubscriptions
	ingress     *integrations.InMemoryIngressController
	recorder    *integrations.InMemoryRecordingController
	logs        *syncBuffer
}

type syncBuffer struct {
	mutex  sync.Mutex
	buffer bytes.Buffer
}

func (sink *syncBuffer) Write(data []byte) (int, error) {
	sink.mutex.Lock()
	defer sink.mutex.Unlock()
	return sink.buffer.Write(data)
}

func (sink *syncBuffer) String() string {
	sink.mutex.Lock()
	defer sink.mutex.Unlock()
	return sink.buffer.String()
}

type liveUser struct {
	id    uuid.UUID
	token string
}

func startLiveModuleAgainstFreshSchema(t *testing.T) *liveHarness {
	t.Helper()
	databaseUrl := os.Getenv("LIVE_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://nantty:nantty@localhost:15432/nantty_live_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("live_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	signer, publicSet := createSigningKeyAndPublicSet(t)
	harness := &liveHarness{
		t: t, money: integrations.NewInMemoryMoneyGateway(), directory: integrations.NewInMemoryParticipantDirectory(),
		publisher: &events.RecordingPublisher{}, clock: &fakeClock{current: time.Now()}, signer: signer,
		relations: integrations.NewInMemorySocialRelations(), catalog: integrations.NewInMemoryStoreCatalog(), subscribers: &integrations.InMemoryCreatorSubscriptions{}, ingress: integrations.NewInMemoryIngressController(),
		recorder: integrations.NewInMemoryRecordingController(), logs: &syncBuffer{},
	}
	settings := configs.LiveSettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, TokenIssuer: testIssuer, TokenAudience: testAudience,
		LiveKitUrl: "http://localhost:7880", LiveKitPublicUrl: "ws://localhost:7880", LiveKitApiKey: "devkey", LiveKitApiSecret: testSecret,
		MediaTokenTimeToLive: 10 * time.Minute, TimerPollInterval: 50 * time.Millisecond, RequireCreatorProgramToHost: true,
		LiveAdTermsCurrentVersion: "2026-10", GiftPlatformBurstLimitPerSecond: 50, InternalApiToken: testInternalToken,
		PlatformBlockedWords: []string{"platformbad"}, RecordingDownloadTimeToLive: time.Hour, LiveKitWebhookEnabled: true,
	}
	verifier := jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, testIssuer, testAudience)
	logSink := io.Writer(harness.logs)
	if os.Getenv("LIVE_TEST_LOG") != "" {
		logSink = io.MultiWriter(harness.logs, os.Stderr)
	}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(logSink, nil)), Health: health.NewRegistryForService("live-test")}
	module, err := live.StartLiveModuleWithSettings(ctx, settings, live.Collaborators{
		Money: harness.money, Directory: harness.directory, Media: integrations.NoopRoomController{}, Verifier: verifier, Publisher: harness.publisher,
		Ingress: harness.ingress, Recorder: harness.recorder, RecordingStorage: integrations.InMemoryRecordingStorage{}, Relations: harness.relations,
		Catalog: harness.catalog, Subscribers: harness.subscribers,
	}, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	module.Container.Now = harness.clock.Now
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

func createSigningKeyAndPublicSet(t *testing.T) (jwk.Key, jwk.Set) {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, _ := jwk.Import(privateKey)
	_ = signingKey.Set(jwk.KeyIDKey, "live-test-key")
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	publicKey, _ := signingKey.PublicKey()
	set := jwk.NewSet()
	_ = set.AddKey(publicKey)
	return signingKey, set
}

func (harness *liveHarness) newUser(name string, roles ...string) liveUser {
	harness.t.Helper()
	identifier := uuid.New()
	harness.directory.Register(integrationsParticipant(identifier, name, containsRole(roles, "creator")))
	now := time.Now()
	token, err := jwt.NewBuilder().Issuer(testIssuer).Audience([]string{testAudience}).Subject(identifier.String()).IssuedAt(now).
		Expiration(now.Add(time.Hour)).Claim("sid", uuid.NewString()).Claim("roles", roles).Build()
	if err != nil {
		harness.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), harness.signer))
	if err != nil {
		harness.t.Fatal(err)
	}
	return liveUser{id: identifier, token: string(signed)}
}

func containsRole(roles []string, wanted string) bool {
	for _, role := range roles {
		if role == wanted {
			return true
		}
	}
	return false
}

func (harness *liveHarness) call(method, path string, user *liveUser, idempotencyKey string, body any) (int, map[string]any) {
	harness.t.Helper()
	var reader io.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, reader)
	request.Header.Set("Content-Type", "application/json")
	if user != nil {
		request.Header.Set("Authorization", "Bearer "+user.token)
	}
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
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

func (harness *liveHarness) expect(method, path string, user *liveUser, idempotencyKey string, body any, wantStatus int) map[string]any {
	harness.t.Helper()
	status, decoded := harness.call(method, path, user, idempotencyKey, body)
	if status != wantStatus {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

func (harness *liveHarness) goLive(host liveUser, extra map[string]any) string {
	harness.t.Helper()
	body := map[string]any{"title": "Test live", "category": "gaming"}
	for key, value := range extra {
		body[key] = value
	}
	return harness.expect("POST", "/api/v1/lives", &host, "", body, http.StatusCreated)["id"].(string)
}

func (harness *liveHarness) waitForEvent(eventType string) {
	harness.t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		for _, published := range harness.publisher.PublishedEventTypes() {
			if published == eventType {
				return
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	harness.t.Fatalf("event %s was not published; got %v", eventType, harness.publisher.PublishedEventTypes())
}

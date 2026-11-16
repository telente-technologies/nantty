package ads_test

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
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/interfaces"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/jwtauth"
	"nantty/platform/postgres"
	"nantty/platform/servicemodule"
	"nantty/platform/staffauth"
)

const (
	testIssuer   = "https://auth.nantty.test"
	testAudience = "nantty-api"
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

type fakeUsers struct {
	mutex sync.Mutex
	known map[string]interfaces.UserSummary
}

func (users *fakeUsers) register(id uuid.UUID, username string) {
	users.mutex.Lock()
	defer users.mutex.Unlock()
	users.known[id.String()] = interfaces.UserSummary{Id: id.String(), Username: username, Name: "User " + username}
}

func (users *fakeUsers) LookupUsers(_ context.Context, ids []string) (map[string]interfaces.UserSummary, error) {
	users.mutex.Lock()
	defer users.mutex.Unlock()
	found := map[string]interfaces.UserSummary{}
	for _, id := range ids {
		if user, ok := users.known[id]; ok {
			found[id] = user
		}
	}
	return found, nil
}

func (users *fakeUsers) FindUserByUsername(_ context.Context, username string) (interfaces.UserSummary, bool, error) {
	users.mutex.Lock()
	defer users.mutex.Unlock()
	for _, user := range users.known {
		if user.Username == username {
			return user, true, nil
		}
	}
	return interfaces.UserSummary{}, false, nil
}

func (users *fakeUsers) FindUserByEmail(_ context.Context, email string) (interfaces.UserSummary, bool, error) {
	users.mutex.Lock()
	defer users.mutex.Unlock()
	for _, user := range users.known {
		if strings.EqualFold(user.Username+"@example.test", email) {
			return user, true, nil
		}
	}
	return interfaces.UserSummary{}, false, nil
}

type harness struct {
	t         *testing.T
	server    *httptest.Server
	module    *src.Module
	users     *fakeUsers
	publisher *events.RecordingPublisher
	clock     *fakeClock
	signer    jwk.Key
}

type testUser struct {
	id    uuid.UUID
	token string
}

type harnessOption func(*src.Collaborators, *configs.AdsSettings)

func startAdsAgainstFreshSchema(t *testing.T, options ...harnessOption) *harness {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test")
	}
	databaseUrl := os.Getenv("ADS_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://nantty:nantty@localhost:15432/nantty_ads_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("ads_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	signer, publicSet := createSigningKeyAndPublicSet(t)
	provider := func(context.Context) (jwk.Set, error) { return publicSet, nil }
	h := &harness{t: t, users: &fakeUsers{known: map[string]interfaces.UserSummary{}}, publisher: &events.RecordingPublisher{}, clock: &fakeClock{current: time.Now()}, signer: signer}
	settings := configs.AdsSettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, AdTokenActiveKeyId: "k1", AdTokenKeys: map[string]string{"k1": "integration-test-ad-token-secret-0001"}, AdTokenTimeToLive: time.Hour,
		InternalSharedSecret: "integration-test-internal-secret-0000001", MediaBaseUrl: "https://cdn.test/media", EnabledPlacements: []string{"feed", "clips", "mart", "search"},
		CandidateRefresh: time.Hour, SettlementInterval: time.Hour, RetentionInterval: time.Hour, RawImpressionRetention: time.Hour, PacingBurstBps: 12_000, PacingUpfrontBps: 10_000,
		MinimumPrerollSeconds: 120, SkipAfterSeconds: 5, AutoBidMultiple: 2, BaselineCtrPpm: 15_000, AllowInMemoryFunding: true, IntelligenceTimeout: 20 * time.Millisecond,
		ReservePerMilleMinor: map[string]int64{"NGN": 50_000}, BoostMinimumDailyMinor: map[string]int64{"NGN": 100_000}, PopulationByCountry: map[string]int64{"NG": 9_000_000},
		UploadUrlLifetime: time.Minute, ReportLinkLifetime: time.Hour, ReportSweepInterval: time.Hour,
	}
	logSink := io.Discard
	if os.Getenv("ADS_TEST_LOG") != "" {
		logSink = os.Stderr
	}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(logSink, nil)), Health: health.NewRegistryForService("ads-test")}
	collaborators := src.Collaborators{
		Publisher: h.publisher, Consent: integrations.StaticConsentReader{Enabled: true}, ViewerAge: integrations.StaticViewerAgeReader{Adult: true}, Countries: integrations.StaticProfileCountryReader{Country: "NG"}, Users: h.users, Now: h.clock.Now,
		Access: jwtauth.NewAccessTokenVerifierFromKeySetProvider(provider, testIssuer, testAudience), Staff: jwtauth.NewAccessTokenVerifierFromKeySetProvider(provider, testIssuer, testAudience),
		StaffStepUp: jwtauth.NewAccessTokenVerifierFromKeySetProvider(provider, testIssuer, staffauth.StepUpAudience),
		Pctr:        integrations.DeterministicPctrScorer{BaselinePpm: 15_000}, Fraud: integrations.NoFraudModel{},
	}
	for _, option := range options {
		option(&collaborators, &settings)
	}
	module, err := src.StartAdsModuleWithSettings(ctx, settings, collaborators, dependencies)
	if err != nil {
		t.Fatal(err)
	}
	h.module = module
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	h.server = httptest.NewServer(mux)
	t.Cleanup(func() { h.server.Close(); _ = module.Close(ctx) })
	return h
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
	_ = signingKey.Set(jwk.KeyIDKey, "ads-test-key")
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	publicKey, _ := signingKey.PublicKey()
	set := jwk.NewSet()
	_ = set.AddKey(publicKey)
	return signingKey, set
}

func (h *harness) newUser(username string, roles ...string) testUser {
	h.t.Helper()
	identifier := uuid.New()
	h.users.register(identifier, username)
	now := time.Now()
	token, err := jwt.NewBuilder().Issuer(testIssuer).Audience([]string{testAudience}).Subject(identifier.String()).IssuedAt(now).Expiration(now.Add(time.Hour)).Claim("sid", uuid.NewString()).Claim("roles", roles).Build()
	if err != nil {
		h.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), h.signer))
	if err != nil {
		h.t.Fatal(err)
	}
	return testUser{id: identifier, token: string(signed)}
}

func (h *harness) call(method, path string, user *testUser, idempotencyKey string, body any) (int, map[string]any) {
	h.t.Helper()
	var reader io.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request, _ := http.NewRequest(method, h.server.URL+path, reader)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Client-Region", "NG")
	if user != nil {
		request.Header.Set("Authorization", "Bearer "+user.token)
	}
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		h.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func (h *harness) expect(method, path string, user *testUser, idempotencyKey string, body any, wantStatus int) map[string]any {
	h.t.Helper()
	status, decoded := h.call(method, path, user, idempotencyKey, body)
	if status != wantStatus {
		h.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

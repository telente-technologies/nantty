package main

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
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	creatorssrc "zudomart/modules/creators/src"
	creatorsconfigs "zudomart/modules/creators/src/configs"
	creatorprogramservices "zudomart/modules/creators/src/modules/creatorProgram/services"
	"zudomart/modules/ledger/src/databases"
	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	"zudomart/modules/ledger/src/loaders"
	ledgermigrations "zudomart/modules/ledger/src/migrations"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	"zudomart/modules/live"
	liveconfigs "zudomart/modules/live/src/configs"
	liveintegrations "zudomart/modules/live/src/integrations"
	livemodels "zudomart/modules/live/src/interfaces"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/jwtauth"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
)

const (
	testAudience      = "zudomart-api"
	testIssuer        = "https://auth.zudomart.test"
	moneyInternalAuth = "internal-test-token-0123456789abcdef"
)

func TestGiftSentThroughLiveChargesRealMoneyAndWritesBothOutboxRows(t *testing.T) {
	ctx := context.Background()
	moneyDatabase := moneytesting.OpenTestDatabaseOrSkip(t)
	ledgerSchema := moneytesting.CreateFreshSchemaWithMigrations(t, moneyDatabase, "ledger", ledgermigrations.Files)
	creatorsSchema := moneytesting.CreateEmptySchema(t, moneyDatabase, "creators")
	tokens := moneytesting.NewTestTokenAuthority(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	moneyDependencies := servicemodule.Dependencies{Logger: logger, Health: health.NewRegistryForService("money-test")}
	creators, err := creatorssrc.StartCreatorsModuleWithSettings(ctx, creatorsconfigs.CreatorsSettings{
		Money: moneytesting.MoneyModuleSettingsForTests("creators", creatorsSchema, ledgerSchema), DefaultTierId: "starter",
	}, moneyDependencies, loaders.MoneyModuleOverrides{Publisher: &events.RecordingPublisher{}, AccessVerifier: tokens.UserVerifier(), StaffVerifiers: tokens.StaffVerifiers()})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = creators.Close(ctx) })
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	grpcServer := loaders.NewMoneyGrpcServer(moneyInternalAuth, creators.RegisterGrpcServices)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(grpcServer.Stop)

	liveDatabaseUrl := os.Getenv("LIVE_TEST_DATABASE_URL")
	if liveDatabaseUrl == "" {
		liveDatabaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_live_test?sslmode=disable"
	}
	liveAdministrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, liveDatabaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	liveSchema := fmt.Sprintf("live_money_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, liveAdministrator, liveSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = liveAdministrator.Exec("DROP SCHEMA " + pgx.Identifier{liveSchema}.Sanitize() + " CASCADE")
		_ = liveAdministrator.Close()
	})
	signer, publicSet := newSigningKeyAndPublicSet(t)
	directory := liveintegrations.NewInMemoryParticipantDirectory()
	liveModule, err := live.StartLiveModuleWithSettings(ctx, liveconfigs.LiveSettings{
		Environment: "test", DatabaseUrl: liveDatabaseUrl, DatabaseSchema: liveSchema, TokenIssuer: testIssuer, TokenAudience: testAudience,
		LiveKitUrl: "http://localhost:7880", LiveKitPublicUrl: "ws://localhost:7880", LiveKitApiKey: "devkey", LiveKitApiSecret: "secret-only-for-local-development-0001",
		MediaTokenTimeToLive: 10 * time.Minute, TimerPollInterval: time.Second, RequireCreatorProgramToHost: true, LiveAdTermsCurrentVersion: "2026-10", GiftPlatformBurstLimitPerSecond: 50,
		MoneyGrpcAddress: listener.Addr().String(), MoneyGrpcToken: moneyInternalAuth, MoneyCallTimeout: 5 * time.Second, GrpcRetryAttempts: 3, GrpcRetryBackoff: 50 * time.Millisecond,
	}, live.Collaborators{
		Directory: directory, Media: liveintegrations.NoopRoomController{}, Publisher: &events.RecordingPublisher{},
		Verifier: jwtauth.NewAccessTokenVerifierFromKeySetProvider(func(context.Context) (jwk.Set, error) { return publicSet, nil }, testIssuer, testAudience),
	}, servicemodule.Dependencies{Logger: logger, Health: health.NewRegistryForService("live-test")})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	liveModule.MountRoutes(mux)
	server := httptest.NewServer(mux)
	t.Cleanup(func() { server.Close(); _ = liveModule.Close(ctx) })

	host, fan := uuid.New(), uuid.New()
	directory.Register(livemodels.Participant{Id: host, Name: "host", Username: "host", IsCreatorProgramMember: true})
	directory.Register(livemodels.Participant{Id: fan, Name: "fan", Username: "fan"})
	if _, err := creators.Program.SetCreatorProgramMembership(ctx, creatorprogramservices.MembershipChange{StaffId: "staff", UserId: host.String(), TierId: "starter", Status: "approved"}); err != nil {
		t.Fatal(err)
	}
	ledger := ledgerservices.NewLedgerInSchema(ledgerSchema)
	issueCoins(t, moneyDatabase, ledger, fan.String(), 1000)

	liveId := call(t, server, signToken(t, signer, host, "creator"), "POST", "/api/v1/lives", "", map[string]any{"title": "Money live", "category": "gaming"}, http.StatusCreated)["id"].(string)
	fanToken := signToken(t, signer, fan, "buyer")
	receipt := call(t, server, fanToken, "POST", "/api/v1/live/gifts", "gift-key-integration-1", map[string]any{"liveId": liveId, "giftId": "gift_rose", "quantity": 2}, http.StatusCreated)
	if receipt["receiverUserId"] != host.String() || receipt["totalCoins"] == nil {
		t.Fatalf("unexpected receipt %v", receipt)
	}
	replay := call(t, server, fanToken, "POST", "/api/v1/live/gifts", "gift-key-integration-1", map[string]any{"liveId": liveId, "giftId": "gift_rose", "quantity": 2}, http.StatusCreated)
	if replay["giftTransactionId"] != receipt["giftTransactionId"] {
		t.Fatalf("replay must return the same transaction: %v %v", receipt, replay)
	}

	report, err := ledger.VerifyTrialBalanceAndCachedBalances(ctx, moneyDatabase)
	if err != nil {
		t.Fatal(err)
	}
	if !report.Healthy() {
		t.Fatalf("ledger unbalanced: %+v", report)
	}
	if spent := 1000 - readBalance(t, moneyDatabase, ledger, ledgermodels.UserSpendableCoinsAccount(fan.String())); spent <= 0 {
		t.Fatalf("the sender must have been charged, spent %d", spent)
	}
	assertOutboxRowCount(t, moneyDatabase, creatorsSchema, "giftTransaction.committed", 1)
	assertOutboxRowCount(t, liveAdministrator, liveSchema, "gift.sent", 1)
}

func readBalance(t *testing.T, database *sql.DB, ledger *ledgerservices.Ledger, account ledgermodels.AccountRef) int64 {
	t.Helper()
	balance, err := ledger.ReadAccountBalance(context.Background(), database, account)
	if err != nil {
		t.Fatal(err)
	}
	return balance
}

func issueCoins(t *testing.T, database *sql.DB, ledger *ledgerservices.Ledger, userId string, coins int64) {
	t.Helper()
	err := databases.RunInMoneyTransaction(context.Background(), database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: "issue-" + userId, Kind: "test.issue", Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: coins},
			{Account: ledgermodels.UserSpendableCoinsAccount(userId), Direction: ledgermodels.Credit, AmountMinor: coins},
		}})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
}

func assertOutboxRowCount(t *testing.T, database *sql.DB, schema, eventType string, expected int) {
	t.Helper()
	var count int
	query := "SELECT count(*) FROM " + pgx.Identifier{schema, "outbox_events"}.Sanitize() + " WHERE event_type = $1"
	if err := database.QueryRow(query, eventType).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != expected {
		t.Fatalf("%s.outbox_events has %d %s rows, want %d", schema, count, eventType, expected)
	}
}

func newSigningKeyAndPublicSet(t *testing.T) (jwk.Key, jwk.Set) {
	t.Helper()
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, _ := jwk.Import(privateKey)
	_ = signingKey.Set(jwk.KeyIDKey, "live-money-test-key")
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	publicKey, _ := signingKey.PublicKey()
	set := jwk.NewSet()
	_ = set.AddKey(publicKey)
	return signingKey, set
}

func signToken(t *testing.T, signer jwk.Key, subject uuid.UUID, roles ...string) string {
	t.Helper()
	now := time.Now()
	token, err := jwt.NewBuilder().Issuer(testIssuer).Audience([]string{testAudience}).Subject(subject.String()).IssuedAt(now).
		Expiration(now.Add(time.Hour)).Claim("sid", uuid.NewString()).Claim("roles", roles).Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), signer))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}

func call(t *testing.T, server *httptest.Server, token, method, path, idempotencyKey string, body any, wantStatus int) map[string]any {
	t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(method, server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	if response.StatusCode != wantStatus {
		t.Fatalf("%s %s = %d %v, want %d", method, path, response.StatusCode, decoded, wantStatus)
	}
	return decoded
}

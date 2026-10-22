package currency

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"zudomart/modules/currency/src/configs"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/identityports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/postgres"
	"zudomart/platform/servicemodule"
	"zudomart/platform/staffauth"
)

type countryLookupByAccount map[uuid.UUID]string

func (lookup countryLookupByAccount) FindAccountCountryCode(_ context.Context, accountId uuid.UUID) (string, error) {
	return lookup[accountId], nil
}

type recordingAudit struct{ events []identityports.AuditEvent }

func (recorder *recordingAudit) RecordAuditEvent(ctx context.Context, event identityports.AuditEvent) error {
	staffauth.MarkAuditRecorded(ctx)
	recorder.events = append(recorder.events, event)
	return nil
}

type currencyHarness struct {
	t             *testing.T
	server        *httptest.Server
	tokens        *identitytest.FakeTokenService
	publisher     *events.RecordingPublisher
	audit         *recordingAudit
	countries     countryLookupByAccount
	administrator *sql.DB
	schema        string
}

func startCurrencyModuleAgainstFreshSchema(t *testing.T) *currencyHarness {
	t.Helper()
	databaseUrl := os.Getenv("CURRENCY_TEST_DATABASE_URL")
	if databaseUrl == "" {
		databaseUrl = "postgres://zudomart:zudomart@localhost:15432/zudomart_test?sslmode=disable"
	}
	ctx := context.Background()
	administrator, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, postgres.DefaultPoolSettings())
	if err != nil {
		t.Skipf("postgres not reachable (run pnpm backend:up): %v", err)
	}
	schema := fmt.Sprintf("currency_test_%d", time.Now().UnixNano())
	if err := postgres.CreateSchemaIfMissingForTestsAndLocalTooling(ctx, administrator, schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { dropSchemaAndClose(administrator, schema) })
	harness := &currencyHarness{t: t, tokens: identitytest.NewFakeTokenService(t), publisher: &events.RecordingPublisher{}, audit: &recordingAudit{}, countries: countryLookupByAccount{}, administrator: administrator, schema: schema}
	identityports.Default.RegisterStaffTokenService(harness.tokens)
	identityports.Default.RegisterStaffSessionChecker(identitytest.ActiveStaffSessionChecker{})
	identityports.Default.RegisterStaffNetworkPolicy(identitytest.PermissiveStaffNetworkPolicy{})
	identityports.Default.RegisterAccountCountryLookup(harness.countries)
	identityports.Default.RegisterAuditRecorder(harness.audit)
	t.Cleanup(func() {
		identityports.Default.RegisterAccountCountryLookup(nil)
		identityports.Default.RegisterAuditRecorder(nil)
	})
	settings := configs.CurrencySettings{
		Environment: "test", DatabaseUrl: databaseUrl, DatabaseSchema: schema, TokenIssuer: identitytest.FakeIssuer,
		TokenAudience: identitytest.FakeAccountAudience, TrustedCountryHeader: "CloudFront-Viewer-Country",
	}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Health: health.NewRegistryForService("currency-test")}
	module, err := StartCurrencyModuleWithSettings(ctx, settings, harness.publisher, dependencies)
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

func (harness *currencyHarness) call(method, path string, headers map[string]string, body any) (int, map[string]any) {
	harness.t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(method, harness.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
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

func (harness *currencyHarness) expect(method, path string, headers map[string]string, body any, wantStatus int) map[string]any {
	harness.t.Helper()
	status, decoded := harness.call(method, path, headers, body)
	if status != wantStatus {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, wantStatus)
	}
	return decoded
}

func staffHeaders(accessToken, stepUpToken string) map[string]string {
	headers := map[string]string{"Authorization": "Bearer " + accessToken}
	if stepUpToken != "" {
		headers["X-Step-Up-Token"] = stepUpToken
	}
	return headers
}

func mustParseUuid(raw string) uuid.UUID {
	return uuid.MustParse(raw)
}

func TestPublicCurrencyListCountriesAndConversion(t *testing.T) {
	harness := startCurrencyModuleAgainstFreshSchema(t)
	currencies := harness.expect("GET", "/api/v1/currencies", nil, nil, http.StatusOK)["data"].([]any)
	if len(currencies) != 7 || harness.expect("GET", "/api/v1/currencies", nil, nil, http.StatusOK)["nextCursor"] != nil {
		t.Fatalf("want seven currencies and a null cursor, got %v", currencies)
	}
	byCode := map[string]map[string]any{}
	for _, entry := range currencies {
		view := entry.(map[string]any)
		byCode[view["code"].(string)] = view
	}
	if byCode["USD"]["rate"] != "1" || byCode["NGN"]["rate"] != "1550" || byCode["GBP"]["rate"] != "0.79" {
		t.Fatalf("unexpected seeded rates %v", byCode)
	}
	countries := harness.expect("GET", "/api/v1/locale/countries", nil, nil, http.StatusOK)["data"].([]any)
	if len(countries) < 10 || countries[0].(map[string]any)["countryCode"] == nil {
		t.Fatalf("unexpected countries %v", countries)
	}
	converted := harness.expect("GET", "/api/v1/currency/convert?amountMinor=100&from=usd&to=NGN", nil, nil, http.StatusOK)
	if converted["amountMinor"] != float64(155000) || converted["currency"] != "NGN" || converted["rateE8"] != float64(155000000000) {
		t.Fatalf("unexpected conversion %v", converted)
	}
	harness.expect("GET", "/api/v1/currency/convert?amountMinor=100&from=USD&to=JPY", nil, nil, http.StatusUnprocessableEntity)
	harness.expect("GET", "/api/v1/currency/convert?amountMinor=-5&from=USD&to=NGN", nil, nil, http.StatusUnprocessableEntity)
	harness.expect("GET", "/api/v1/currency/convert?amountMinor=abc&from=USD&to=NGN", nil, nil, http.StatusBadRequest)
}

func TestMissingRateIsSeedableAndConversionFailsClosed(t *testing.T) {
	harness := startCurrencyModuleAgainstFreshSchema(t)
	if _, err := harness.administrator.Exec(fmt.Sprintf("DELETE FROM %s WHERE currency = 'NGN'", pgx.Identifier{harness.schema, "exchange_rate_revisions"}.Sanitize())); err != nil {
		t.Fatal(err)
	}
	missing := harness.expect("GET", "/api/v1/currency/convert?amountMinor=100&from=USD&to=NGN", nil, nil, http.StatusServiceUnavailable)
	if missing["code"] != "EXCHANGE_RATE_UNAVAILABLE" {
		t.Fatalf("unexpected missing-rate response %v", missing)
	}
	writer, stepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"currency.rates.write"})
	created := harness.expect("PUT", "/api/v1/admin/exchange-rates/NGN", staffHeaders(writer, stepUp), map[string]any{"rate": "1600", "reason": "market moved"}, http.StatusOK)
	if created["usdRateE8"] != float64(160_000_000_000) {
		t.Fatalf("unexpected first write %v", created)
	}
	converted := harness.expect("GET", "/api/v1/currency/convert?amountMinor=100&from=USD&to=NGN", nil, nil, http.StatusOK)
	if converted["amountMinor"] != float64(160000) {
		t.Fatalf("unexpected conversion after seeding %v", converted)
	}
}

func TestLocaleLayersProfileThenCdnHeaderThenClientHint(t *testing.T) {
	harness := startCurrencyModuleAgainstFreshSchema(t)
	accountId := "7f1d3a52-0b0e-4c0e-9d57-1a2b3c4d5e6f"
	token := harness.tokens.SignAccountAccessToken(t, accountId)
	assertLocale := func(headers map[string]string, wantCurrency, wantSource string) {
		t.Helper()
		got := harness.expect("GET", "/api/v1/locale", headers, nil, http.StatusOK)
		if got["currency"] != wantCurrency || got["source"] != wantSource {
			t.Fatalf("headers %v: got %v, want %s via %s", headers, got, wantCurrency, wantSource)
		}
	}
	assertLocale(nil, "USD", "unknown")
	assertLocale(map[string]string{"X-Client-Region": "KE"}, "KES", "client_region_hint")
	assertLocale(map[string]string{"X-Client-Region": "KE", "CloudFront-Viewer-Country": "NG"}, "NGN", "trusted_proxy_header")
	assertLocale(map[string]string{"CloudFront-Viewer-Country": "JP"}, "USD", "trusted_proxy_header")
	headers := map[string]string{"Authorization": "Bearer " + token, "CloudFront-Viewer-Country": "NG"}
	assertLocale(headers, "NGN", "trusted_proxy_header")
	harness.countries[mustParseUuid(accountId)] = "GH"
	assertLocale(headers, "GHS", "profile")
	assertLocale(map[string]string{"Authorization": "Bearer garbage.token.value", "CloudFront-Viewer-Country": "ZA"}, "ZAR", "trusted_proxy_header")
}

func TestAdminExchangeRateSecurityAndHistory(t *testing.T) {
	harness := startCurrencyModuleAgainstFreshSchema(t)
	writer, stepUp, staffId := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"currency.rates.write", "currency.rates.read"})
	readerOnly, readerStepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"currency.rates.read"})
	body := map[string]any{"rate": "1600.50", "reason": "market moved"}

	harness.expect("GET", "/api/v1/admin/exchange-rates", nil, nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/exchange-rates", map[string]string{"Authorization": "Bearer " + harness.tokens.SignAccountAccessToken(t, staffId)}, nil, http.StatusUnauthorized)
	harness.expect("PUT", "/api/v1/admin/exchange-rates/NGN", staffHeaders(readerOnly, readerStepUp), body, http.StatusForbidden)
	missing := harness.expect("PUT", "/api/v1/admin/exchange-rates/NGN", staffHeaders(writer, ""), body, http.StatusForbidden)
	if missing["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("expected step-up requirement, got %v", missing)
	}
	_, otherStepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"currency.rates.write"})
	harness.expect("PUT", "/api/v1/admin/exchange-rates/NGN", staffHeaders(writer, otherStepUp), body, http.StatusForbidden)

	headers := staffHeaders(writer, stepUp)
	for name, invalid := range map[string]map[string]any{
		"zero rate": {"rate": "0", "reason": "fixing it"}, "negative": {"rate": "-3", "reason": "fixing it"}, "words": {"rate": "lots", "reason": "fixing it"},
		"short reason": {"rate": "1600", "reason": "no"}, "extra field": {"rate": "1600", "reason": "fixing it", "bogus": 1},
	} {
		if status, _ := harness.call("PUT", "/api/v1/admin/exchange-rates/NGN", headers, invalid); status != http.StatusUnprocessableEntity && status != http.StatusBadRequest {
			t.Errorf("%s: status %d", name, status)
		}
	}
	harness.expect("PUT", "/api/v1/admin/exchange-rates/USD", headers, map[string]any{"rate": "2", "reason": "attempt change"}, http.StatusUnprocessableEntity)
	harness.expect("PUT", "/api/v1/admin/exchange-rates/JPY", headers, body, http.StatusUnprocessableEntity)
	jump := harness.expect("PUT", "/api/v1/admin/exchange-rates/NGN", headers, map[string]any{"rate": "3000", "reason": "currency shock"}, http.StatusUnprocessableEntity)
	if jump["code"] != "LARGE_RATE_CHANGE_NEEDS_CONFIRMATION" {
		t.Fatalf("unexpected %v", jump)
	}

	updated := harness.expect("PUT", "/api/v1/admin/exchange-rates/ngn", headers, body, http.StatusOK)
	if updated["rate"] != "1600.5" || updated["source"] != "admin" || updated["setBy"] != staffId {
		t.Fatalf("unexpected revision %v", updated)
	}
	harness.expect("PUT", "/api/v1/admin/exchange-rates/NGN", headers, map[string]any{"rate": "3000", "reason": "currency shock", "confirmLargeChange": true}, http.StatusOK)
	converted := harness.expect("GET", "/api/v1/currency/convert?amountMinor=100&from=USD&to=NGN", nil, nil, http.StatusOK)
	if converted["amountMinor"] != float64(300000) {
		t.Fatalf("conversion must use the newest rate: %v", converted)
	}

	history := harness.expect("GET", "/api/v1/admin/exchange-rates?currency=NGN", staffHeaders(readerOnly, ""), nil, http.StatusOK)["data"].([]any)
	if len(history) != 3 || history[0].(map[string]any)["rate"] != "3000" || history[2].(map[string]any)["source"] != "seed" {
		t.Fatalf("unexpected history %v", history)
	}
	allHistory := harness.expect("GET", "/api/v1/admin/exchange-rates", staffHeaders(readerOnly, ""), nil, http.StatusOK)["data"].([]any)
	if len(allHistory) != 9 {
		t.Fatalf("want 7 seed + 2 admin revisions, got %d", len(allHistory))
	}
	harness.expect("GET", "/api/v1/admin/exchange-rates?currency=XXX", staffHeaders(readerOnly, ""), nil, http.StatusUnprocessableEntity)
	harness.expect("GET", "/api/v1/admin/exchange-rates?cursor=nope", staffHeaders(readerOnly, ""), nil, http.StatusUnprocessableEntity)

	if len(harness.audit.events) != 2 || harness.audit.events[0].Action != "currency.exchange_rate_set" || harness.audit.events[0].ActorId != staffId {
		t.Fatalf("unexpected audit events %+v", harness.audit.events)
	}
	waitForEventTypes(t, harness, "exchangeRate.updated")
}

func waitForEventTypes(t *testing.T, harness *currencyHarness, wanted string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		for _, published := range harness.publisher.PublishedEventTypes() {
			if published == wanted {
				return
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("event %s not published, got %v", wanted, harness.publisher.PublishedEventTypes())
}

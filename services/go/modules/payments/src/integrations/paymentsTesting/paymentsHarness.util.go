package paymentstesting

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	moneytesting "zudomart/modules/ledger/src/databases/moneyTesting"
	"zudomart/modules/ledger/src/loaders"
	ledgermigrations "zudomart/modules/ledger/src/migrations"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	paymentsrc "zudomart/modules/payments/src"
	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/container"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/repositories"
	"zudomart/platform/events"
	"zudomart/platform/health"
	"zudomart/platform/servicemodule"
)

type MoneyHarness struct {
	T            *testing.T
	Database     *sql.DB
	LedgerSchema string
	Ledger       *ledgerservices.Ledger
	Bachs        *FakeBachs
	Directory    *PermissiveAccountDirectory
	Tokens       *moneytesting.TestTokenAuthority
	Publisher    *events.RecordingPublisher
	Payments     *paymentsrc.Module
	Mux          *http.ServeMux
	Server       *httptest.Server
	Dependencies servicemodule.Dependencies
}

func StartMoneyHarnessWithPayments(t *testing.T, storeVerifiers map[string]interfaces.StoreReceiptVerifier) *MoneyHarness {
	t.Helper()
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	ledgerSchema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "ledger", ledgermigrations.Files)
	harness := &MoneyHarness{
		T: t, Database: database, LedgerSchema: ledgerSchema, Ledger: ledgerservices.NewLedgerInSchema(ledgerSchema),
		Bachs: StartFakeBachs(t), Directory: &PermissiveAccountDirectory{Unverified: map[string]bool{}}, Tokens: moneytesting.NewTestTokenAuthority(t), Publisher: &events.RecordingPublisher{},
		Mux:          http.NewServeMux(),
		Dependencies: servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Health: health.NewRegistryForService("money-test")},
	}
	settings := configs.PaymentsSettings{
		Money:             moneytesting.MoneyModuleSettingsForTests("payments", moneytesting.CreateEmptySchema(t, database, "payments"), ledgerSchema),
		AllowedReturnUrls: []string{"https://zudomart.test/pay/return", "https://app.zudomart.test/pay/return"}, DefaultProvider: "bachs",
		PlatformCommissionBps: 500, CheckoutExpiryMinutes: 15, ConnectedAccountCountry: "NG",
		OnboardingReturnUrl: "https://zudomart.test/seller/verification/return", OnboardingRefreshUrl: "https://zudomart.test/seller/verification/refresh",
		WebSubscriptionPlanProducts: map[string]string{"premium_web": "prod_premium_web"},
	}
	bachs := integrations.NewBachsConnectProvider(integrations.BachsConnectSettings{
		BaseUrl: harness.Bachs.Server.URL, SecretKey: FakeBachsSecretKey, WebhookSigningSecrets: []string{FakeBachsSigningSecret}, MaximumAttempts: 3,
	})
	providers := map[string]interfaces.ConnectProvider{"bachs": bachs}
	module, err := paymentsrc.StartPaymentsModuleWithSettings(context.Background(), settings, harness.Dependencies, harness.Overrides(), container.Overrides{Providers: providers, StoreVerifiers: storeVerifiers, Accounts: harness.Directory})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = module.Close(context.Background()) })
	harness.Payments = module
	module.MountRoutes(harness.Mux)
	harness.Server = httptest.NewServer(harness.Mux)
	t.Cleanup(harness.Server.Close)
	return harness
}

type PermissiveAccountDirectory struct {
	mutex      sync.Mutex
	Unverified map[string]bool
}

func (directory *PermissiveAccountDirectory) FindAccountContact(_ context.Context, accountId string) (repositories.VerifiedAccountContact, bool, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	return repositories.VerifiedAccountContact{Email: "user-" + accountId[:min(len(accountId), 8)] + "@zudomart.test", Name: "Test User", EmailVerified: !directory.Unverified[accountId]}, true, nil
}

func (directory *PermissiveAccountDirectory) MarkUnverified(accountId string) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	directory.Unverified[accountId] = true
}

func (harness *MoneyHarness) Overrides() loaders.MoneyModuleOverrides {
	return loaders.MoneyModuleOverrides{Publisher: harness.Publisher, AccessVerifier: harness.Tokens.UserVerifier(), StaffVerifiers: harness.Tokens.StaffVerifiers()}
}

func (harness *MoneyHarness) MountModule(module servicemodule.Module) {
	module.MountRoutes(harness.Mux)
	harness.T.Cleanup(func() { _ = module.Close(context.Background()) })
}

type HarnessResponse struct {
	Status  int
	Headers http.Header
	Body    map[string]any
	Raw     []byte
}

func (harness *MoneyHarness) Call(method, path, accessToken, idempotencyKey string, body any, extraHeaders ...http.Header) HarnessResponse {
	harness.T.Helper()
	var reader io.Reader = http.NoBody
	if raw, isRaw := body.([]byte); isRaw {
		reader = bytes.NewReader(raw)
	} else if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request, _ := http.NewRequest(method, harness.Server.URL+path, reader)
	request.Header.Set("Content-Type", "application/json")
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	for _, headers := range extraHeaders {
		for name, values := range headers {
			request.Header[name] = values
		}
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.T.Fatal(err)
	}
	defer response.Body.Close()
	raw, _ := io.ReadAll(response.Body)
	decoded := map[string]any{}
	_ = json.Unmarshal(raw, &decoded)
	return HarnessResponse{Status: response.StatusCode, Headers: response.Header, Body: decoded, Raw: raw}
}

func (harness *MoneyHarness) AssertLedgerHealthy() {
	harness.T.Helper()
	report, err := harness.Ledger.VerifyTrialBalanceAndCachedBalances(context.Background(), harness.Database)
	if err != nil {
		harness.T.Fatal(err)
	}
	if !report.Healthy() {
		harness.T.Fatalf("ledger unhealthy: %+v", report)
	}
}

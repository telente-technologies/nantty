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
	"strings"
	"sync"
	"testing"
	"time"

	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/loaders"
	ledgermigrations "nantty/modules/ledger/src/migrations"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	paymentsrc "nantty/modules/payments/src"
	"nantty/modules/payments/src/configs"
	"nantty/modules/payments/src/container"
	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/repositories"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/servicemodule"
)

type MoneyHarness struct {
	T            *testing.T
	Database     *sql.DB
	LedgerSchema string
	Ledger       *ledgerservices.Ledger
	Flutterwave  *FakeFlutterwave
	UsersSchema  string
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
	return startMoneyHarness(t, storeVerifiers)
}

func StartMoneyHarnessWithFlutterwave(t *testing.T) *MoneyHarness {
	t.Helper()
	return startMoneyHarness(t, nil)
}

func startMoneyHarness(t *testing.T, storeVerifiers map[string]interfaces.StoreReceiptVerifier) *MoneyHarness {
	t.Helper()
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	ledgerSchema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "ledger", ledgermigrations.Files)
	harness := &MoneyHarness{
		T: t, Database: database, LedgerSchema: ledgerSchema, Ledger: ledgerservices.NewLedgerInSchema(ledgerSchema),
		Flutterwave: StartFakeFlutterwave(t), Directory: &PermissiveAccountDirectory{Unverified: map[string]bool{}}, Tokens: moneytesting.NewTestTokenAuthority(t), Publisher: &events.RecordingPublisher{},
		Mux:          http.NewServeMux(),
		Dependencies: servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Health: health.NewRegistryForService("money-test")},
	}
	harness.UsersSchema = createHarnessUsersSchema(t, database)
	settings := configs.PaymentsSettings{
		Money:             moneytesting.MoneyModuleSettingsForTests("payments", moneytesting.CreateEmptySchema(t, database, "payments"), ledgerSchema),
		AllowedReturnUrls: []string{"https://zudomart.test/pay/return", "https://app.zudomart.test/pay/return"}, DefaultProvider: "flutterwave",
		EscrowFeeBps: 150, BusinessEscrowFeeBps: 100, EscrowMode: "e2", CheckoutExpiryMinutes: 15, ConnectedAccountCountry: "NG", UsersSchema: harness.UsersSchema,
		CheckoutChannels: []string{"card", "bank", "ussd", "bank_transfer"}, SubaccountBearsFee: true, CardVerificationAmount: 5000,
		OnboardingReturnUrl: "https://zudomart.test/seller/verification/return", OnboardingRefreshUrl: "https://zudomart.test/seller/verification/refresh",
		WebSubscriptionPlanProducts: map[string]string{"premium_web": "PLN_premium_web"},
		UnverifiedSellerSalesCaps:   map[string]int64{"NGN": 1 << 50, "USD": 1 << 50},
		DataEncryptionKey:           bytes.Repeat([]byte{7}, 32), SavedCardFingerprintKey: "fingerprint-test-key", InternalApiToken: strings.Repeat("i", 32),
	}
	fakeSettings := harness.Flutterwave.Settings()
	fakeSettings.RetryBaseDelay = time.Millisecond
	adapter := integrations.NewFlutterwaveProvider(fakeSettings)
	providers := map[string]interfaces.PaymentProvider{"flutterwave": adapter}
	applyFlutterwaveHarnessSettings(&settings)
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

func createHarnessUsersSchema(t *testing.T, database *sql.DB) string {
	t.Helper()
	schema := moneytesting.CreateEmptySchema(t, database, "users")
	for _, statement := range []string{
		`CREATE TABLE "` + schema + `".profiles (account_id uuid NOT NULL, kind text NOT NULL, country_code text)`,
		`CREATE TABLE "` + schema + `".profile_checkmarks (account_id uuid NOT NULL, color text, status text)`,
		`CREATE TABLE "` + schema + `".verification_cases (account_id uuid NOT NULL, status text, liveness_result text, face_match_result text)`,
	} {
		if _, err := database.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	return schema
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

func applyFlutterwaveHarnessSettings(settings *configs.PaymentsSettings) {
	settings.DefaultProvider = "flutterwave"
	settings.Flutterwave = configs.FlutterwaveSettings{SecretKey: FakeFlutterwaveSecretKey, WebhookHash: FakeFlutterwaveWebhookHash, MerchantId: FakeFlutterwaveMerchantId}
	settings.Wallets = configs.WalletSettings{
		AliasEmailDomain: "wallets.zudomart.test", PsaCountries: []string{"NG"}, DepositFeeBps: 50, DepositFeeCaps: map[string]int64{"NGN": 100_000},
		DepositHold: 24 * time.Hour, FirstDepositHold: 72 * time.Hour, CardBuyerWalletAtCheckout: true, MovementStuckAfter: time.Hour,
	}
	settings.CustomerValidationMode = "required"
}

func (harness *MoneyHarness) NonZeroBalances() map[string]int64 {
	harness.T.Helper()
	rows, err := harness.Database.Query(`SELECT code, balance_minor FROM "` + harness.LedgerSchema + `".ledger_accounts WHERE balance_minor <> 0 ORDER BY code`)
	if err != nil {
		harness.T.Fatal(err)
	}
	defer rows.Close()
	balances := map[string]int64{}
	for rows.Next() {
		var code string
		var balance int64
		if err := rows.Scan(&code, &balance); err != nil {
			harness.T.Fatal(err)
		}
		balances[code] = balance
	}
	return balances
}

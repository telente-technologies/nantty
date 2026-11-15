package catalog_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/catalog/src"
	"nantty/modules/catalog/src/configs"
	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/platform/commerceports"
	"nantty/platform/identityports/identitytest"
	"nantty/platform/jwtauth"
	"nantty/platform/staffaudit"
	"nantty/platform/usersdirectory"
)

const harnessInternalToken = "catalog-test-internal-token-0123456789"

type fakeAudit struct {
	mutex   sync.Mutex
	records []staffaudit.Record
}

func (audit *fakeAudit) Record(_ context.Context, record staffaudit.Record) error {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	audit.records = append(audit.records, record)
	return nil
}

func (audit *fakeAudit) History(_ context.Context, subjectType, subjectId string) ([]json.RawMessage, error) {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	history := []json.RawMessage{}
	for _, record := range audit.records {
		if record.SubjectType == subjectType && record.SubjectId == subjectId {
			encoded, _ := json.Marshal(record)
			history = append(history, encoded)
		}
	}
	return history, nil
}

func (audit *fakeAudit) has(action string) bool {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	for _, record := range audit.records {
		if record.Action == action {
			return true
		}
	}
	return false
}

type fakeIdentity struct{}

func (fakeIdentity) UserSummaries(_ context.Context, accountIds []uuid.UUID) (map[uuid.UUID]map[string]any, error) {
	found := map[uuid.UUID]map[string]any{}
	for _, accountId := range accountIds {
		found[accountId] = map[string]any{"id": accountId.String(), "username": "user" + accountId.String()[:6], "displayName": "Test User", "status": "ACTIVE"}
	}
	return found, nil
}

type httpHarness struct {
	t         *testing.T
	module    *src.Module
	server    *httptest.Server
	tokens    *identitytest.FakeTokenService
	audit     *fakeAudit
	directory *fakeDirectory
	stock     *fakeStock
	purchases *fakePurchases
	follows   *fakeStoreFollows
}

func startHttpHarness(t *testing.T) *httpHarness {
	t.Helper()
	tokens := identitytest.NewFakeTokenService(t)
	verifier := func(audience string) *jwtauth.AccessTokenVerifier {
		return jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, audience)
	}
	audit, follows := &fakeAudit{}, &fakeStoreFollows{followers: map[uuid.UUID]int{}}
	collaborators := src.Collaborators{StoreFollows: follows, StoreFollowWrites: follows,
		Verifier: verifier(identitytest.FakeAccountAudience), Audit: audit, Identity: fakeIdentity{},
		Staff: container.StaffVerifiers{Access: verifier("nantty-admin"), StepUp: verifier("nantty-admin-step-up")},
	}
	module := startAgainstFreshSchemaWith(t, collaborators, func(settings *configs.CatalogSettings) { settings.InternalApiToken = harnessInternalToken })
	directory := &fakeDirectory{profiles: map[uuid.UUID]usersdirectory.ProfileName{}}
	module.Container.Users = directory
	stock, purchases := &fakeStock{locations: map[uuid.UUID]uuid.UUID{}}, &fakePurchases{received: map[uuid.UUID]map[uuid.UUID]bool{}}
	commerceports.Default.RegisterInventoryStock(stock)
	commerceports.Default.RegisterPurchaseVerifier(purchases)
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return &httpHarness{t: t, module: module, server: server, tokens: tokens, audit: audit, directory: directory, stock: stock, purchases: purchases, follows: follows}
}

func (harness *httpHarness) client() *ent.Client { return harness.module.Container.Client }

func (harness *httpHarness) account(handle string) (uuid.UUID, string) {
	accountId := harness.directory.add(handle)
	return accountId, harness.tokens.SignAccountAccessToken(harness.t, accountId.String())
}

func (harness *httpHarness) staff(permissions ...string) (string, []string) {
	access, stepUp, _ := harness.tokens.SignStaffTokensForTest(harness.t, "admin", permissions)
	return access, []string{"X-Step-Up-Token", stepUp}
}

func (harness *httpHarness) call(method, path, token string, body any, headers ...string) (int, map[string]any) {
	harness.t.Helper()
	var reader *bytes.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	} else {
		reader = bytes.NewReader(nil)
	}
	request, _ := http.NewRequest(method, harness.server.URL+path, reader)
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
	return response.StatusCode, decoded
}

func (harness *httpHarness) expect(method, path, token string, body any, want int, headers ...string) map[string]any {
	harness.t.Helper()
	status, decoded := harness.call(method, path, token, body, headers...)
	if status != want {
		harness.t.Fatalf("%s %s = %d %v, want %d", method, path, status, decoded, want)
	}
	return decoded
}

func (harness *httpHarness) store(ownerId uuid.UUID, name string) *ent.Store {
	harness.t.Helper()
	ctx := context.Background()
	row, err := harness.client().Store.Create().SetOwnerAccountID(ownerId).SetBusinessProfileID(uuid.New()).SetName(name).
		SetSlug(strings.ToLower(strings.ReplaceAll(name, " ", "-")) + "-" + uuid.NewString()[:6]).SetCountryCode("NG").SetCurrency("NGN").Save(ctx)
	if err != nil {
		harness.t.Fatal(err)
	}
	if err := harness.client().StoreMember.Create().SetStoreID(row.ID).SetAccountID(ownerId).SetRole("owner").Exec(ctx); err != nil {
		harness.t.Fatal(err)
	}
	return row
}

func (harness *httpHarness) product(store *ent.Store, name string, priceMinor int64, active bool) *ent.Product {
	harness.t.Helper()
	ctx := context.Background()
	status := "draft"
	if active {
		status = "active"
	}
	row, err := harness.client().Product.Create().SetStoreID(store.ID).SetName(name).SetCurrency(store.Currency).SetStatus(status).
		SetPublishedOnline(active).SetMinPriceMinor(priceMinor).SetTrackInventory(false).SetPublishedAt(harness.module.Container.Now()).Save(ctx)
	if err != nil {
		harness.t.Fatal(err)
	}
	sku := "SKU-" + uuid.NewString()[:8]
	if err := harness.client().ProductVariant.Create().SetProductID(row.ID).SetStoreID(store.ID).SetTitle(name).SetSku(sku).SetSkuKey(strings.ToLower(sku)).SetPriceMinor(priceMinor).Exec(ctx); err != nil {
		harness.t.Fatal(err)
	}
	return row
}

func (harness *httpHarness) outboxTypes() []string {
	harness.t.Helper()
	types, err := harness.client().OutboxEvent.Query().Select("event_type").Strings(context.Background())
	if err != nil {
		harness.t.Fatal(err)
	}
	return types
}

func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func items(body map[string]any, key string) []any {
	list, _ := body[key].([]any)
	return list
}

func (harness *httpHarness) parseId(raw any) uuid.UUID {
	harness.t.Helper()
	text, _ := raw.(string)
	identifier, err := uuid.Parse(text)
	if err != nil {
		harness.t.Fatalf("not an id: %v", raw)
	}
	return identifier
}

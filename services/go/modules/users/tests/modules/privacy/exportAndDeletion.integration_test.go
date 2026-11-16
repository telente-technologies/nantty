package privacy

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/userconsent"
	expiredataexports "nantty/modules/users/src/modules/dataExport/commands/expireDataExports"
	processnextdataexport "nantty/modules/users/src/modules/dataExport/commands/processNextDataExport"
	exportservices "nantty/modules/users/src/modules/dataExport/services"
)

type memoryObjectStore struct {
	mutex   sync.Mutex
	objects map[string][]byte
	failPut bool
}

func newMemoryObjectStore() *memoryObjectStore {
	return &memoryObjectStore{objects: map[string][]byte{}}
}

func (store *memoryObjectStore) EnsureBucket(context.Context) error { return nil }

func (store *memoryObjectStore) Put(_ context.Context, key string, body []byte, _ string) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if store.failPut {
		return errors.New("storage unavailable")
	}
	store.objects[key] = body
	return nil
}

func (store *memoryObjectStore) Delete(_ context.Context, key string) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	delete(store.objects, key)
	return nil
}

func (store *memoryObjectStore) PresignGet(_ context.Context, key string, timeToLive time.Duration) (string, error) {
	return fmt.Sprintf("https://object-store.test/%s?expires=%d", key, int(timeToLive.Seconds())), nil
}

func (store *memoryObjectStore) get(key string) ([]byte, bool) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	body, found := store.objects[key]
	return body, found
}

func readZipEntries(t *testing.T, archive []byte) map[string]string {
	t.Helper()
	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatal(err)
	}
	entries := map[string]string{}
	for _, file := range reader.File {
		opened, _ := file.Open()
		body, _ := io.ReadAll(opened)
		entries[file.Name] = string(body)
	}
	return entries
}

func (harness *privacyHarness) seedUserOwnedData(accountId uuid.UUID, handle string) {
	harness.t.Helper()
	ctx := context.Background()
	client := harness.container.Client
	if err := client.Profile.Create().SetAccountID(accountId).SetKind(profile.KindPersonal).SetHandle(handle).SetDisplayName("Ada L").SetBio("Mathematician").Exec(ctx); err != nil {
		harness.t.Fatal(err)
	}
	if err := client.ShippingAddress.Create().SetAccountID(accountId).SetRecipientName("Ada L").SetPhone("+2348034417720").SetLine1("1 Analytical Way").SetCountryCode("NG").SetIsDefault(true).Exec(ctx); err != nil {
		harness.t.Fatal(err)
	}
	for _, consentType := range []userconsent.ConsentType{userconsent.ConsentTypeAnalytics, userconsent.ConsentTypeMarketing} {
		if err := client.UserConsent.Create().SetAccountID(accountId).SetConsentType(consentType).SetStatus(userconsent.StatusGranted).SetPolicyVersion("1.0").SetConsentedAt(time.Now()).SetIPAddress("203.0.113.9").SetUserAgent("test").Exec(ctx); err != nil {
			harness.t.Fatal(err)
		}
	}
}

func TestDataExportLifecycleWithRateLimitExpiryAndFailureRecovery(t *testing.T) {
	harness := startPrivacyHarness(t)
	store := newMemoryObjectStore()
	exportservices.UseObjectStoreForTests(store)
	t.Cleanup(func() { exportservices.UseObjectStoreForTests(nil) })
	accountId, token := harness.newAccount("exporter")
	_, intruder := harness.newAccount("intruder")
	harness.seedUserOwnedData(accountId, "exporter")
	worker := processnextdataexport.Handler{Container: harness.container}

	harness.expect("POST", "/api/v1/users/me/data-exports", "", nil, http.StatusUnauthorized)
	harness.expectWithHeaders("POST", "/api/v1/users/me/data-exports", token, map[string]string{"Idempotency-Key": "short"}, nil, http.StatusBadRequest)
	requested := harness.expectWithHeaders("POST", "/api/v1/users/me/data-exports", token, map[string]string{"Idempotency-Key": "export-request-0001"}, nil, http.StatusAccepted)
	if requested["status"] != "requested" || requested["downloadUrl"] != nil {
		t.Fatalf("unexpected %v", requested)
	}
	replay := harness.expectWithHeaders("POST", "/api/v1/users/me/data-exports", token, map[string]string{"Idempotency-Key": "export-request-0001"}, nil, http.StatusAccepted)
	if replay["id"] != requested["id"] {
		t.Fatalf("same idempotency key must return the same export: %v %v", replay, requested)
	}
	if conflict := harness.expect("POST", "/api/v1/users/me/data-exports", token, nil, http.StatusConflict); conflict["code"] != "EXPORT_ALREADY_ACTIVE" {
		t.Fatalf("unexpected %v", conflict)
	}

	if worked, err := worker.Execute(context.Background(), processnextdataexport.Command{}); err != nil || !worked {
		t.Fatalf("worker must process the request: %v %v", worked, err)
	}
	if worked, _ := worker.Execute(context.Background(), processnextdataexport.Command{}); worked {
		t.Fatal("nothing left to process")
	}
	exportPath := "/api/v1/users/me/data-exports/" + requested["id"].(string)
	harness.expect("GET", exportPath, intruder, nil, http.StatusNotFound)
	ready := harness.expect("GET", exportPath, token, nil, http.StatusOK)
	link, _ := ready["downloadUrl"].(string)
	if ready["status"] != "ready" || !strings.Contains(link, accountId.String()) || !strings.Contains(link, "expires=300") || ready["expiresAt"] == nil {
		t.Fatalf("ready export needs a short-lived presigned link: %v", ready)
	}
	key := strings.TrimPrefix(strings.SplitN(link, "?", 2)[0], "https://object-store.test/")
	archive, found := store.get(key)
	if !found {
		t.Fatal("archive was not stored")
	}
	entries := readZipEntries(t, archive)
	for _, name := range []string{"manifest.json", "account.json", "profiles.json", "addresses.json", "consents.json", "termsAcceptances.json", "usernameHistory.json", "privacySettings.json"} {
		if _, present := entries[name]; !present {
			t.Errorf("archive is missing %s", name)
		}
	}
	if !strings.Contains(entries["profiles.json"], "exporter") || !strings.Contains(entries["addresses.json"], "1 Analytical Way") || strings.Contains(entries["account.json"], "password") {
		t.Fatalf("archive must hold the user's own data and no secrets: %v", entries)
	}

	if limited := harness.expect("POST", "/api/v1/users/me/data-exports", token, nil, http.StatusTooManyRequests); limited["code"] != "EXPORT_RATE_LIMITED" {
		t.Fatalf("unexpected %v", limited)
	}
	harness.clock.advance(73 * time.Hour)
	expirer := expiredataexports.Handler{Container: harness.container}
	if expired, err := expirer.Execute(context.Background(), expiredataexports.Command{}); err != nil || expired != 1 {
		t.Fatalf("one archive must expire: %d %v", expired, err)
	}
	if _, stillThere := store.get(key); stillThere {
		t.Fatal("expired archive object must be deleted")
	}
	after := harness.expect("GET", exportPath, token, nil, http.StatusOK)
	if after["status"] != "expired" || after["downloadUrl"] != nil {
		t.Fatalf("expired export has no link: %v", after)
	}

	store.failPut = true
	failing := harness.expect("POST", "/api/v1/users/me/data-exports", token, nil, http.StatusAccepted)
	if _, err := worker.Execute(context.Background(), processnextdataexport.Command{}); err != nil {
		t.Fatal(err)
	}
	failed := harness.expect("GET", "/api/v1/users/me/data-exports/"+failing["id"].(string), token, nil, http.StatusOK)
	if failed["status"] != "failed" || failed["downloadUrl"] != nil {
		t.Fatalf("storage failure must mark the export failed: %v", failed)
	}
	store.failPut = false
	harness.expect("POST", "/api/v1/users/me/data-exports", token, nil, http.StatusAccepted)
	if items := listItems(t, harness.expect("GET", "/api/v1/users/me/data-exports", token, nil, http.StatusOK)); len(items) != 3 {
		t.Fatalf("history should list three exports: %v", items)
	}
	types := harness.outboxEventTypes()
	if countOf(types, "dataExport.requested") != 3 || countOf(types, "dataExport.completed") != 1 {
		t.Fatalf("unexpected events %v", types)
	}
}

func TestDataExportRoundTripThroughObjectStorage(t *testing.T) {
	harness := startPrivacyHarness(t)
	exportservices.UseObjectStoreForTests(nil)
	t.Cleanup(func() { exportservices.UseObjectStoreForTests(nil) })
	if !objectStorageIsWritable(harness) {
		t.Skip("object storage on localhost:18333 is not reachable or not writable (run pnpm backend:up, free disk space)")
	}
	accountId, token := harness.newAccount("roundtrip")
	harness.seedUserOwnedData(accountId, "roundtrip")
	requested := harness.expect("POST", "/api/v1/users/me/data-exports", token, nil, http.StatusAccepted)
	if worked, err := (processnextdataexport.Handler{Container: harness.container}).Execute(context.Background(), processnextdataexport.Command{}); err != nil || !worked {
		t.Fatalf("worker failed against object storage: %v %v", worked, err)
	}
	ready := harness.expect("GET", "/api/v1/users/me/data-exports/"+requested["id"].(string), token, nil, http.StatusOK)
	link, _ := ready["downloadUrl"].(string)
	if link == "" {
		t.Fatalf("export is not downloadable: %v", ready)
	}
	response, err := http.Get(link)
	if err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("presigned download failed: %v %v", err, response)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if entries := readZipEntries(t, body); !strings.Contains(entries["profiles.json"], "roundtrip") {
		t.Fatalf("downloaded archive is wrong: %v", entries)
	}
	_, _ = (expiredataexports.Handler{Container: harness.container}).Execute(context.Background(), expiredataexports.Command{})
}

func TestStaffManagesRetentionPoliciesWithVersionCheckAndAudit(t *testing.T) {
	harness := startPrivacyHarness(t)
	reader, _, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"privacy.retention.read"})
	writer, writerStepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"privacy.retention.write"})
	harness.expect("GET", "/api/v1/admin/retention-policies", "", nil, http.StatusUnauthorized)
	harness.expect("GET", "/api/v1/admin/retention-policies", writer, nil, http.StatusForbidden)
	policies := listItems(t, harness.expect("GET", "/api/v1/admin/retention-policies", reader, nil, http.StatusOK))
	if len(policies) != 8 {
		t.Fatalf("eight retention categories expected: %v", policies)
	}
	for _, policy := range policies {
		if policy["action"] != "retain" || policy["retentionDays"] != nil || policy["needsLegalReview"] != true || policy["version"].(float64) != 1 {
			t.Fatalf("defaults must retain, name no period and flag legal review: %v", policy)
		}
	}
	update := map[string]any{"action": "anonymize", "retentionDays": 365, "needsLegalReview": false, "expectedVersion": 1, "reason": "approved by counsel"}
	harness.expect("PUT", "/api/v1/admin/retention-policies/messages", reader, update, http.StatusForbidden)
	if missing := harness.expect("PUT", "/api/v1/admin/retention-policies/messages", writer, update, http.StatusForbidden); missing["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("unexpected %v", missing)
	}
	headers := map[string]string{"X-Step-Up-Token": writerStepUp}
	harness.expectWithHeaders("PUT", "/api/v1/admin/retention-policies/pets", writer, headers, update, http.StatusNotFound)
	harness.expectWithHeaders("PUT", "/api/v1/admin/retention-policies/messages", writer, headers, map[string]any{"action": "shred"}, http.StatusBadRequest)
	changed := harness.expectWithHeaders("PUT", "/api/v1/admin/retention-policies/messages", writer, headers, update, http.StatusOK)
	if changed["action"] != "anonymize" || changed["version"].(float64) != 2 || changed["retentionDays"].(float64) != 365 || changed["needsLegalReview"] != false {
		t.Fatalf("unexpected %v", changed)
	}
	if conflict := harness.expectWithHeaders("PUT", "/api/v1/admin/retention-policies/messages", writer, headers, update, http.StatusConflict); conflict["code"] != "VERSION_CONFLICT" {
		t.Fatalf("unexpected %v", conflict)
	}
	if countOf(harness.audit.actions(), "privacy.retention_policy_updated") != 1 || countOf(harness.outboxEventTypes(), "retentionPolicy.updated") != 1 {
		t.Fatalf("a change needs an audit record and an event: %v", harness.audit.actions())
	}
}

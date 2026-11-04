package ads

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/events"
	"nantty/modules/ads/src/generated/ent/adaccountmember"
	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/modules/reporting/delivery"
)

type fakeAudienceSource struct{ members []string }

func (source fakeAudienceSource) StoreCustomers(context.Context, string, int, int) ([]string, error) {
	return source.members, nil
}
func (source fakeAudienceSource) Engagers(context.Context, string, string, int) ([]string, error) {
	return source.members, nil
}
func (source fakeAudienceSource) Followers(context.Context, string) ([]string, error) {
	return source.members, nil
}

type fakeIdentityMatcher struct{ byHash map[string]string }

func (matcher fakeIdentityMatcher) MatchEmailHashes(_ context.Context, hashes []string) ([]string, error) {
	matched := []string{}
	for _, hash := range hashes {
		if id, ok := matcher.byHash[hash]; ok {
			matched = append(matched, id)
		}
	}
	return matched, nil
}
func (matcher fakeIdentityMatcher) MatchPhoneHashes(context.Context, []string) ([]string, error) {
	return nil, nil
}

type fakeContentSources struct{}

func (fakeContentSources) ListContentSources(_ context.Context, query interfaces.ContentSourceQuery) ([]map[string]any, string, error) {
	return []map[string]any{{"id": "post-1", "type": "post", "title": "Hello"}, {"id": "post-2", "type": "post", "eligible": true, "ineligibleReason": nil}}, "", nil
}

func hashEmail(email string) string {
	digest := sha256.Sum256([]byte(email))
	return hex.EncodeToString(digest[:])
}

func newUserIds(count int) []string {
	ids := make([]string, count)
	for index := range ids {
		ids[index] = uuid.NewString()
	}
	return ids
}

func createAccount(h *harness, owner *testUser, key string) string {
	account := h.expect("POST", "/api/v1/ads/accounts", owner, key, map[string]any{"name": "Fabric Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	return account["id"].(string)
}

func TestAudiencesBuildMatchRoundAndProtectInUseAudiences(t *testing.T) {
	people := newUserIds(150)
	matcher := fakeIdentityMatcher{byHash: map[string]string{hashEmail("ada@example.com"): uuid.NewString()}}
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.Source, collaborators.Identity = fakeAudienceSource{members: people}, matcher
	})
	owner, outsider := h.newUser("audience-owner"), h.newUser("audience-outsider")
	accountId := createAccount(h, &owner, "audience-account")
	base := "/api/v1/ads/accounts/" + accountId

	engagers := h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "engagers", "name": "Watchers", "retentionDays": 30, "engagementSource": "clips_watched"}, http.StatusCreated)
	size := engagers["approximateSize"].(map[string]any)
	if engagers["status"] != "ready" || size["lower"].(float64) >= 150 || size["upper"].(float64) <= 150 {
		t.Fatalf("150 people is ready and exposed only as a range: %v", engagers)
	}
	audienceId := engagers["id"].(string)

	small := h.expect("POST", base+"/audiences/customer-lists", &owner, "list-key-0001", map[string]any{"name": "VIPs", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{hashEmail("ada@example.com"), hashEmail("nobody@example.com")}}, http.StatusCreated)
	if small["status"] != "too_small" {
		t.Fatalf("a list matching fewer than 100 people cannot be targeted: %v", small)
	}
	replay := h.expect("POST", base+"/audiences/customer-lists", &owner, "list-key-0001", map[string]any{"name": "VIPs", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{hashEmail("ada@example.com")}}, http.StatusCreated)
	if replay["id"] != small["id"] {
		t.Fatal("the same Idempotency-Key must return the same audience")
	}
	h.expect("POST", base+"/audiences/customer-lists", &owner, "list-key-0002", map[string]any{"name": "Raw", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{"ada@example.com"}}, http.StatusBadRequest)
	h.expect("POST", base+"/audiences/customer-lists", &outsider, "list-key-0003", map[string]any{"name": "No", "identifierType": "email", "hashAlgorithm": "sha256", "hashedIdentifiers": []string{hashEmail("a@b.c")}}, http.StatusNotFound)

	count, err := h.module.Container.Client.AdAudienceMember.Query().Count(context.Background())
	if err != nil || count != 151 {
		t.Fatalf("only matched people are stored (150 engagers + 1 matched email), got %d %v", count, err)
	}

	lookalike := h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "lookalike", "name": "Like watchers", "sourceAudienceId": audienceId, "countryCode": "NG", "similarityPercent": 2}, http.StatusCreated)
	if lookalike["status"] != "ready" {
		t.Fatalf("2%% of nigeria is a ready lookalike: %v", lookalike)
	}
	h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "lookalike", "name": "Nested", "sourceAudienceId": lookalike["id"], "countryCode": "NG", "similarityPercent": 2}, http.StatusBadRequest)
	h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "lookalike", "name": "Wide", "sourceAudienceId": audienceId, "countryCode": "NG", "similarityPercent": 11}, http.StatusBadRequest)
	h.expect("POST", base+"/audiences", &owner, "", map[string]any{"type": "store_customers", "name": "Buyers", "retentionDays": 30, "minimumOrders": 1}, http.StatusBadRequest)

	h.expect("PATCH", base+"/audiences/"+audienceId, &owner, "", map[string]any{"name": "Clip watchers"}, http.StatusOK)
	list := h.expect("GET", base+"/audiences?type=engagers", &owner, "", nil, http.StatusOK)
	if items := list["data"].([]any); len(items) != 1 || items[0].(map[string]any)["name"] != "Clip watchers" {
		t.Fatalf("unexpected list %v", list)
	}
	h.expect("DELETE", base+"/audiences/"+audienceId, &owner, "", nil, http.StatusConflict)
	h.expect("DELETE", base+"/audiences/"+lookalike["id"].(string), &owner, "", nil, http.StatusNoContent)
	h.expect("DELETE", base+"/audiences/"+audienceId, &owner, "", nil, http.StatusNoContent)

	h.expect("POST", "/internal/v1/ads/audiences/membership", nil, "", map[string]any{"userId": people[0]}, http.StatusUnauthorized)
}

func TestAudienceEstimateReturnsRangesAndRejectsAnEmptyLocationList(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner := h.newUser("estimate-owner")
	base := "/api/v1/ads/accounts/" + createAccount(h, &owner, "estimate-account")
	request := map[string]any{
		"objective": "traffic", "audience": nigeriaAudience(), "placements": []any{"feed", "clips"},
		"budget":      map[string]any{"type": "daily", "amount": map[string]any{"amountMinor": 500_000, "currency": "NGN"}},
		"bidStrategy": map[string]any{"type": "auto", "amount": nil}, "schedule": map[string]any{"startAt": time.Now().Format(time.RFC3339), "endAt": nil},
	}
	estimate := h.expect("POST", base+"/estimates/audience", &owner, "", request, http.StatusOK)
	reach := estimate["dailyReach"].(map[string]any)
	if estimate["breadth"] != "broad" || reach["lower"].(float64) >= reach["upper"].(float64) || estimate["resultLabel"] != "Link clicks" {
		t.Fatalf("unexpected estimate %v", estimate)
	}
	request["audience"].(map[string]any)["locations"] = []any{}
	h.expect("POST", base+"/estimates/audience", &owner, "", request, http.StatusBadRequest)
}

func TestScheduledReportsAreDeliveredAsFilesAndAnEmailEvent(t *testing.T) {
	storage := integrations.NewMemoryObjectStorage()
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, _ *configs.AdsSettings) { collaborators.Storage = storage })
	owner, outsider := h.newUser("report-owner"), h.newUser("report-outsider")
	base := "/api/v1/ads/accounts/" + createAccount(h, &owner, "report-account")
	input := map[string]any{"name": "Weekly spend", "recipients": []string{"Ada@Example.com"}, "frequency": "daily", "breakdown": "campaign", "metrics": []string{"spend", "impressions"}}

	h.expect("POST", base+"/reports/scheduled", &outsider, "", input, http.StatusNotFound)
	h.expect("POST", base+"/reports/scheduled", &owner, "", map[string]any{"name": "x", "recipients": []string{}, "frequency": "daily", "breakdown": "campaign", "metrics": []string{"spend"}}, http.StatusBadRequest)
	created := h.expect("POST", base+"/reports/scheduled", &owner, "", input, http.StatusCreated)
	if created["recipients"].([]any)[0] != "ada@example.com" {
		t.Fatalf("recipients are normalised: %v", created)
	}
	if list := h.expect("GET", base+"/reports/scheduled", &owner, "", nil, http.StatusOK); len(list["data"].([]any)) != 1 {
		t.Fatalf("unexpected list %v", list)
	}

	h.clock.Advance(48 * time.Hour)
	if err := deliverDueReports(h); err != nil {
		t.Fatal(err)
	}
	if len(storage.Objects) != 2 {
		t.Fatalf("a CSV and a PDF are stored, got %d objects", len(storage.Objects))
	}
	for key, body := range storage.Objects {
		isPdf := strings.HasSuffix(key, ".pdf")
		if isPdf != strings.HasPrefix(string(body), "%PDF") {
			t.Fatalf("%s has unexpected content", key)
		}
	}
	rows, err := h.module.Container.Client.OutboxEvent.Query().All(context.Background())
	ready := 0
	for _, row := range rows {
		var envelope struct {
			Data events.AdReportReadyEventData `json:"data"`
		}
		if row.EventType == events.AdReportReady && json.Unmarshal(row.Payload, &envelope) == nil && len(envelope.Data.Recipients) == 1 && envelope.Data.Recipients[0] == "ada@example.com" && envelope.Data.CsvUrl != "" && envelope.Data.PdfUrl != "" {
			ready++
		}
	}
	if err != nil || ready != 1 {
		t.Fatalf("exactly one adReport.ready event with links, got %d %v", ready, err)
	}
	if err := deliverDueReports(h); err != nil || len(storage.Objects) != 2 {
		t.Fatal("a second sweep must not resend a report that is not due again")
	}

	pdf, status := h.rawGet(fmt.Sprintf("%s/reports/export.pdf?from=2026-01-01&to=2026-01-31&breakdown=campaign", base), &owner)
	if status != http.StatusOK || !strings.HasPrefix(pdf, "%PDF-1.4") {
		t.Fatalf("pdf export failed: %d", status)
	}
	h.expect("DELETE", base+"/reports/scheduled/"+created["id"].(string), &owner, "", nil, http.StatusNoContent)
	h.expect("DELETE", base+"/reports/scheduled/"+created["id"].(string), &owner, "", nil, http.StatusNotFound)
}

func TestAnalystCanReadButCannotManageScheduledReports(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	owner, analyst := h.newUser("report-permission-owner"), h.newUser("report-permission-analyst")
	accountID := createAccount(h, &owner, "report-permission-account")
	parsedAccountID, err := uuid.Parse(accountID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := h.module.Container.Client.AdAccountMember.Create().SetAccountID(parsedAccountID).SetUserID(analyst.id).SetRole(adaccountmember.RoleAnalyst).Save(context.Background()); err != nil {
		t.Fatal(err)
	}
	base := "/api/v1/ads/accounts/" + accountID + "/reports/scheduled"
	input := map[string]any{"name": "Sensitive weekly report", "recipients": []string{"external@example.test"}, "frequency": "daily", "breakdown": "campaign", "metrics": []string{"spend"}}

	created := h.expect("POST", base, &owner, "", input, http.StatusCreated)
	h.expect("GET", base, &analyst, "", nil, http.StatusOK)
	if status, _ := h.call("POST", base, &analyst, "", input); status != http.StatusForbidden {
		t.Fatalf("analyst POST must be forbidden, got %d", status)
	}
	if status, _ := h.call("DELETE", base+"/"+created["id"].(string), &analyst, "", nil); status != http.StatusForbidden {
		t.Fatalf("analyst DELETE must be forbidden, got %d", status)
	}
	if reports := h.expect("GET", base, &owner, "", nil, http.StatusOK)["data"].([]any); len(reports) != 1 {
		t.Fatalf("analyst mutations must not create or remove reports: %v", reports)
	}
}

func TestCreativeMediaUploadUsesPresignedStorageAndWaitsForProcessing(t *testing.T) {
	storage := integrations.NewMemoryObjectStorage()
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.Storage, collaborators.Content = storage, fakeContentSources{}
	})
	owner := h.newUser("media-owner")
	accountId := createAccount(h, &owner, "media-account")
	base := "/api/v1/ads/accounts/" + accountId

	h.expect("POST", base+"/creatives/media/uploads", &owner, "", map[string]any{"fileName": "a.gif", "mimeType": "image/gif", "sizeBytes": 10}, http.StatusUnsupportedMediaType)
	h.expect("POST", base+"/creatives/media/uploads", &owner, "", map[string]any{"fileName": "a.mp4", "mimeType": "video/mp4", "sizeBytes": 600 << 20}, http.StatusRequestEntityTooLarge)
	intent := h.expect("POST", base+"/creatives/media/uploads", &owner, "", map[string]any{"fileName": "../../hero.jpg", "mimeType": "image/jpeg", "sizeBytes": 5, "clientMetadata": map[string]any{"width": 800, "height": 600}}, http.StatusCreated)
	mediaId := intent["mediaId"].(string)
	if !strings.Contains(intent["uploadUrl"].(string), "ads-media/") || strings.Contains(intent["uploadUrl"].(string), "hero") {
		t.Fatalf("the object key must not contain the client file name: %v", intent)
	}
	h.expect("POST", base+"/creatives/media/"+mediaId+"/complete", &owner, "", nil, http.StatusConflict)
	_ = storage.PutObject(context.Background(), fmt.Sprintf("ads-media/%s/%s/original.jpg", accountId, mediaId), "image/jpeg", []byte("12345"))
	if done := h.expect("POST", base+"/creatives/media/"+mediaId+"/complete", &owner, "", nil, http.StatusOK); done["status"] != "processing" {
		t.Fatalf("unexpected %v", done)
	}
	if pending := h.expect("GET", base+"/creatives/media/"+mediaId, &owner, "", nil, http.StatusOK); pending["media"] != nil {
		t.Fatalf("media is not usable while processing: %v", pending)
	}
	h.expect("POST", "/internal/v1/ads/media/"+mediaId+"/processed", nil, "", map[string]any{"status": "ready", "width": 800, "height": 600}, http.StatusUnauthorized)
	h.callInternal(t, "/internal/v1/ads/media/"+mediaId+"/processed", map[string]any{"status": "ready", "width": 800, "height": 600}, http.StatusNoContent)
	ready := h.expect("GET", base+"/creatives/media/"+mediaId, &owner, "", nil, http.StatusOK)
	if ready["status"] != "ready" || !strings.HasPrefix(ready["media"].(map[string]any)["url"].(string), "memory://download/ads-media/") {
		t.Fatalf("unexpected ready media %v", ready)
	}

	sources := h.expect("GET", base+"/content-sources?type=post", &owner, "", nil, http.StatusOK)
	items := sources["data"].([]any)
	if items[0].(map[string]any)["eligible"] != false || items[1].(map[string]any)["eligible"] != true {
		t.Fatalf("an item the source did not mark eligible must be treated as ineligible: %v", items)
	}
}

func deliverDueReports(h *harness) error {
	return delivery.EnqueueDueReports(context.Background(), h.module.Container)
}

func (h *harness) rawGet(path string, user *testUser) (string, int) {
	h.t.Helper()
	request, _ := http.NewRequest("GET", h.server.URL+path, nil)
	request.Header.Set("Authorization", "Bearer "+user.token)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		h.t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	return string(body), response.StatusCode
}

func (h *harness) callInternal(t *testing.T, path string, body any, wantStatus int) {
	t.Helper()
	encoded, _ := json.Marshal(body)
	timestamp, nonce, bodyHash := fmt.Sprint(time.Now().Unix()), uuid.NewString(), sha256.Sum256(encoded)
	mac := hmac.New(sha256.New, []byte("integration-test-internal-secret-0000001"))
	mac.Write([]byte("v1\nPOST\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + hex.EncodeToString(bodyHash[:])))
	request, _ := http.NewRequest("POST", h.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-nantty-timestamp", timestamp)
	request.Header.Set("x-nantty-nonce", nonce)
	request.Header.Set("x-nantty-signature", "v1="+hex.EncodeToString(mac.Sum(nil)))
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != wantStatus {
		payload, _ := io.ReadAll(response.Body)
		t.Fatalf("POST %s = %d %s, want %d", path, response.StatusCode, payload, wantStatus)
	}
}

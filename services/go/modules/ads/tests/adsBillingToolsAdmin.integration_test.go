package ads_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/jobs"
	evaluaterules "nantty/modules/ads/src/modules/tools/commands/evaluateRules"
)

type fakeTopUps struct {
	mutex   sync.Mutex
	started []interfaces.TopUpStartRequest
	status  string
}

func (gateway *fakeTopUps) StartTopUp(_ context.Context, request interfaces.TopUpStartRequest) (interfaces.StartedTopUp, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.started = append(gateway.started, request)
	return interfaces.StartedTopUp{TopUpId: "money-top-up-1", Reference: "ref-top-up-1", CheckoutUrl: "https://checkout.flutterwave.test/abc"}, nil
}

func (gateway *fakeTopUps) ReadTopUp(context.Context, string, string) (interfaces.TopUpStatus, error) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	return interfaces.TopUpStatus{TopUpId: "money-top-up-1", Status: gateway.status}, nil
}

type fakeHistory struct{}

func (fakeHistory) ListHistory(_ context.Context, subjectType, subjectId string) ([]json.RawMessage, error) {
	return []json.RawMessage{json.RawMessage(`{"id":"audit-1","action":"seeded","target":{"type":"` + subjectType + `","id":"` + subjectId + `","label":""}}`)}, nil
}

type fakeSummaries struct{}

func (fakeSummaries) LookupSummaries(_ context.Context, ids []string) (map[string]json.RawMessage, error) {
	found := map[string]json.RawMessage{}
	for _, id := range ids {
		found[id] = json.RawMessage(`{"id":"` + id + `","username":"owner","displayName":"Owner Name","riskLevel":"LOW"}`)
	}
	return found, nil
}

func TestTopUpsCheckMembershipCreditOncePaidAndIssueReceipts(t *testing.T) {
	gateway := &fakeTopUps{status: "pending"}
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, settings *configs.AdsSettings) {
		collaborators.TopUps = gateway
		settings.AdsAppUrl = "http://localhost:3300"
	})
	owner, stranger := h.newUser("topup-owner"), h.newUser("topup-stranger")
	accountId := createAccount(h, &owner, "topup-account")
	base := "/api/v1/ads/accounts/" + accountId + "/billing"
	minimum := h.expect("GET", base, &owner, "", nil, http.StatusOK)["minimumTopUp"].(map[string]any)
	body := map[string]any{"amount": minimum, "provider": "flutterwave", "returnPath": "/accounts/" + accountId + "/billing/return"}
	h.expect("POST", base+"/top-ups", &stranger, "topup-key-stranger", body, http.StatusNotFound)
	h.expect("POST", base+"/top-ups", &owner, "", body, http.StatusBadRequest)
	h.expect("POST", base+"/top-ups", &owner, "topup-key-usd", map[string]any{"amount": map[string]any{"amountMinor": minimum["amountMinor"], "currency": "USD"}, "provider": "flutterwave", "returnPath": ""}, http.StatusBadRequest)
	checkout := h.expect("POST", base+"/top-ups", &owner, "topup-key-1", body, http.StatusCreated)
	if checkout["reference"] != "ref-top-up-1" || checkout["authorizationUrl"] != "https://checkout.flutterwave.test/abc" || checkout["provider"] != "flutterwave" {
		t.Fatalf("unexpected checkout %v", checkout)
	}
	if request := gateway.started[0]; request.UserId != owner.id.String() || request.ReturnTo != "http://localhost:3300/accounts/"+accountId+"/billing/return" || request.IdempotencyKey != "topup-key-1" {
		t.Fatalf("unexpected money request %+v", request)
	}
	if pending := h.expect("GET", base+"/top-ups/ref-top-up-1", &owner, "", nil, http.StatusOK); pending["status"] != "pending" {
		t.Fatalf("top-up should be pending: %v", pending)
	}
	gateway.status = "succeeded"
	if paid := h.expect("GET", base+"/top-ups/ref-top-up-1", &owner, "", nil, http.StatusOK); paid["status"] != "succeeded" || paid["completedAt"] == nil {
		t.Fatalf("top-up should be succeeded: %v", paid)
	}
	event := `{"id":"` + uuid.NewString() + `","type":"adBalance.toppedUp","occurredAt":"2026-10-05T10:00:00Z","data":{"adAccountId":"` + accountId + `","topUpId":"money-top-up-1","amount":{"amountMinor":` + jsonNumber(minimum["amountMinor"]) + `,"currency":"NGN"}}}`
	if err := jobs.HandleDomainEventMessage(h.module.Container)(context.Background(), []byte(event)); err != nil {
		t.Fatal(err)
	}
	overview := h.expect("GET", base, &owner, "", nil, http.StatusOK)
	if overview["balance"].(map[string]any)["amountMinor"] != minimum["amountMinor"] {
		t.Fatalf("balance must rise exactly once: %v", overview["balance"])
	}
	transactions := h.expect("GET", base+"/transactions", &owner, "", nil, http.StatusOK)["data"].([]any)
	if len(transactions) != 1 || transactions[0].(map[string]any)["type"] != "top_up" || transactions[0].(map[string]any)["receiptAvailable"] != true {
		t.Fatalf("expected one receipted top-up: %v", transactions)
	}
	receipt, status := h.rawGet(base+"/transactions/"+transactions[0].(map[string]any)["id"].(string)+"/receipt", &owner)
	if status != http.StatusOK || !strings.HasPrefix(receipt, "%PDF-") {
		t.Fatalf("receipt: %d", status)
	}
	if _, status := h.rawGet(base+"/transactions/"+uuid.NewString()+"/receipt", &owner); status != http.StatusNotFound {
		t.Fatalf("missing transaction: %d", status)
	}
	if err := h.module.Container.Client.AdFundsTransaction.Create().SetAccountID(mustParseUuid(t, accountId)).SetType("ad_spend").SetAmountMinor(-40_000).SetCurrency("NGN").SetDescription("Ad spend").SetReference("spend:test").Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	invoices := h.expect("GET", base+"/invoices", &owner, "", nil, http.StatusOK)["data"].([]any)
	if len(invoices) != 1 || invoices[0].(map[string]any)["tax"].(map[string]any)["amountMinor"].(float64) != 3_000 || invoices[0].(map[string]any)["status"] != "open" {
		t.Fatalf("unexpected invoices %v", invoices)
	}
	if pdf, status := h.rawGet(base+"/invoices/"+invoices[0].(map[string]any)["id"].(string)+"/download", &owner); status != http.StatusOK || !strings.HasPrefix(pdf, "%PDF-") {
		t.Fatalf("invoice download: %d", status)
	}
}

func jsonNumber(value any) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func TestToolsConversionEventsExperimentsAndRules(t *testing.T) {
	h := startAdsAgainstFreshSchema(t)
	ctx := context.Background()
	owner, analyst := h.newUser("tools-owner"), h.newUser("tools-analyst")
	accountId := createAccount(h, &owner, "tools-account")
	base := "/api/v1/ads/accounts/" + accountId
	h.expect("POST", base+"/conversion-events", &owner, "", map[string]any{"name": "Buys", "eventType": "purchase", "storeId": "", "tracksValue": true}, http.StatusConflict)

	bundle := createBundle(h, &owner, accountId, "tools-bundle", nil)
	campaign := bundle["campaign"].(map[string]any)
	adSet := bundle["adSet"].(map[string]any)
	second := map[string]any{"campaignId": campaign["id"]}
	for key, value := range adSet {
		if key == "name" || key == "audience" || key == "placementMode" || key == "placements" || key == "schedule" || key == "budget" || key == "bidStrategy" || key == "frequencyCap" || key == "conversionEventId" {
			second[key] = value
		}
	}
	second["name"] = "Second"
	secondSet := h.expect("POST", base+"/ad-sets", &owner, "tools-second", second, http.StatusCreated)
	start, end := h.clock.Now().Add(-time.Minute).Format(time.RFC3339), h.clock.Now().Add(5*24*time.Hour).Format(time.RFC3339)
	arms := []any{map[string]any{"adSetId": adSet["id"], "trafficPercent": 50}, map[string]any{"adSetId": secondSet["id"], "trafficPercent": 50}}
	experiment := map[string]any{"name": "Audience test", "campaignId": campaign["id"], "variable": "audience", "metric": "ctr", "arms": arms, "startAt": start, "endAt": end}
	h.expect("POST", base+"/experiments", &analyst, "", experiment, http.StatusNotFound)
	short := map[string]any{}
	for key, value := range experiment {
		short[key] = value
	}
	short["endAt"] = h.clock.Now().Add(24 * time.Hour).Format(time.RFC3339)
	h.expect("POST", base+"/experiments", &owner, "", short, http.StatusBadRequest)
	created := h.expect("POST", base+"/experiments", &owner, "", experiment, http.StatusCreated)
	if created["status"] != "running" || created["arms"].([]any)[1].(map[string]any)["adSetName"] != "Second" {
		t.Fatalf("unexpected experiment %v", created)
	}
	h.expect("POST", base+"/experiments", &owner, "", experiment, http.StatusBadRequest)
	stopped := h.expect("POST", base+"/experiments/"+created["id"].(string)+"/stop", &owner, "", nil, http.StatusOK)
	if stopped["status"] != "stopped" || stopped["result"] == nil {
		t.Fatalf("unexpected stopped experiment %v", stopped)
	}
	h.expect("POST", base+"/experiments/"+created["id"].(string)+"/stop", &owner, "", nil, http.StatusConflict)

	rule := map[string]any{"name": "Pause expensive", "level": "campaign", "targetIds": []any{campaign["id"]}, "checkEveryMinutes": 30,
		"conditions": []any{map[string]any{"metric": "spend", "operator": "greater_than", "value": 100, "window": "lifetime"}}, "action": map[string]any{"type": "pause", "percent": nil}}
	h.expect("POST", base+"/rules", &owner, "", map[string]any{"name": "Bad", "level": "ad", "targetIds": []any{uuid.NewString()}, "checkEveryMinutes": 60,
		"conditions": rule["conditions"], "action": map[string]any{"type": "increase_budget", "percent": 10}}, http.StatusBadRequest)
	savedRule := h.expect("POST", base+"/rules", &owner, "", rule, http.StatusCreated)
	campaignId := mustParseUuid(t, campaign["id"].(string))
	client := h.module.Container.Client
	if err := client.AdCampaign.UpdateOneID(campaignId).SetStatus(adcampaign.StatusActive).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	day := h.clock.Now().Format("2006-01-02")
	if err := client.AdStatsDaily.Create().SetDay(day).SetAccountID(mustParseUuid(t, accountId)).SetCampaignID(campaignId).SetAdGroupID(mustParseUuid(t, adSet["id"].(string))).
		SetAdID(uuid.New()).SetPlacement("feed").SetImpressions(1_000).SetClicks(10).SetSpendMicros(500 * 100 * 1_000_000).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	h.clock.Advance(31 * time.Minute)
	if triggered, err := (evaluaterules.Handler{Container: h.module.Container}).Execute(ctx); err != nil || triggered != 1 {
		t.Fatalf("rule should trigger once: %d %v", triggered, err)
	}
	if paused, _ := client.AdCampaign.Get(ctx, campaignId); paused.Status != adcampaign.StatusPaused {
		t.Fatalf("rule should pause the campaign, got %s", paused.Status)
	}
	listed := h.expect("GET", base+"/rules", &analyst, "", nil, http.StatusNotFound)
	_ = listed
	rules := h.expect("GET", base+"/rules", &owner, "", nil, http.StatusOK)["data"].([]any)
	if rules[0].(map[string]any)["triggerCount"].(float64) != 1 {
		t.Fatalf("trigger count not recorded: %v", rules)
	}
	h.expect("PATCH", base+"/rules/"+savedRule["id"].(string), &owner, "", map[string]any{"status": "paused"}, http.StatusOK)
	h.expect("DELETE", base+"/rules/"+savedRule["id"].(string), &owner, "", nil, http.StatusNoContent)
	h.expect("DELETE", base+"/rules/"+savedRule["id"].(string), &owner, "", nil, http.StatusNotFound)
}

func TestAdminAdvertiserDetailAndInternalStoreReport(t *testing.T) {
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.History, collaborators.Summaries = fakeHistory{}, fakeSummaries{}
	})
	owner, staff := h.newUser("admin-owner"), h.newUser("admin-staff", "name:Sam", "perm:advertisers:manage")
	accountId := createAccount(h, &owner, "admin-account")
	createBundle(h, &owner, accountId, "report-bundle", nil)
	detail := h.expect("GET", "/api/v1/admin/advertisers/"+accountId, &staff, "", nil, http.StatusOK)
	if detail["owner"].(map[string]any)["displayName"] != "Owner Name" || len(detail["history"].([]any)) != 1 {
		t.Fatalf("unexpected advertiser detail %v", detail)
	}
	h.expect("GET", "/api/v1/admin/advertisers/"+uuid.NewString(), &staff, "", nil, http.StatusNotFound)
	suspended := h.expect("POST", "/api/v1/admin/advertisers/"+accountId+"/suspend", &staff, "", map[string]any{"reason": "Repeated violations"}, http.StatusOK)
	if suspended["status"] != "SUSPENDED" || suspended["owner"] == nil || suspended["currency"] != "NGN" {
		t.Fatalf("suspend must return the full advertiser: %v", suspended)
	}
	list := h.expect("GET", "/api/v1/admin/advertisers", &staff, "", nil, http.StatusOK)
	if list["data"].([]any)[0].(map[string]any)["owner"].(map[string]any)["username"] != "owner" {
		t.Fatalf("owner must be a user summary: %v", list)
	}

	if err := h.module.Container.Client.AdAccount.UpdateOneID(mustParseUuid(t, accountId)).SetStoreID("store-77").Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/internal/stores/store-77/campaign-report?from=2026-01-01&to=2026-12-31"
	request, _ := http.NewRequest("GET", h.server.URL+path, nil)
	response, err := http.DefaultClient.Do(request)
	if err != nil || response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("the report needs the internal token: %v %v", response.StatusCode, err)
	}
	response.Body.Close()
	request.Header.Set("X-Internal-Token", "integration-test-internal-secret-0000001")
	response, err = http.DefaultClient.Do(request)
	if err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("report: %v %v", response.StatusCode, err)
	}
	defer response.Body.Close()
	var page struct {
		Data []map[string]any `json:"data"`
	}
	_ = json.NewDecoder(response.Body).Decode(&page)
	if page.Data == nil {
		t.Fatalf("report must be a data envelope")
	}
}

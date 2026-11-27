package creators_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/creators/src"
	"nantty/modules/creators/src/configs"
	"nantty/modules/creators/src/generated/ent/outboxevent"
	"nantty/modules/creators/src/generated/ent/tiptransaction"
	creatorsmigrations "nantty/modules/creators/src/migrations"
	moneyservices "nantty/modules/creators/src/modules/creatorMoney/services"
	"nantty/modules/creators/src/repositories"
	ledgerconstants "nantty/modules/ledger/src/constants"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/loaders"
	ledgermigrations "nantty/modules/ledger/src/migrations"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/servicemodule"
	"nantty/platform/staffauth"
)

type httpHarness struct {
	*creatorsHarness
	tokens *moneytesting.TestTokenAuthority
	mux    *http.ServeMux
}

func startHttpHarness(t *testing.T, directory repositories.StaticCreatorsDirectory) *httpHarness {
	t.Helper()
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	ledgerSchema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "ledger", ledgermigrations.Files)
	tokens := moneytesting.NewTestTokenAuthority(t)
	settings := configs.CreatorsSettings{Money: moneytesting.MoneyModuleSettingsForTests("creators", moneytesting.CreateFreshSchemaWithMigrations(t, database, "creators", creatorsmigrations.Files), ledgerSchema), DefaultTierId: "starter"}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Health: health.NewRegistryForService("creators-test")}
	module, err := src.StartCreatorsModuleWithSettings(context.Background(), settings, dependencies, loaders.MoneyModuleOverrides{
		Publisher: &events.RecordingPublisher{}, AccessVerifier: tokens.UserVerifier(), StaffVerifiers: tokens.StaffVerifiers(),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = module.Close(context.Background()) })
	module.Container.Directory = directory
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	return &httpHarness{creatorsHarness: &creatorsHarness{t: t, database: database, ledger: ledgerservices.NewLedgerInSchema(ledgerSchema), module: module}, tokens: tokens, mux: mux}
}

func (harness *httpHarness) call(method, path, token, key string, body any, headers ...http.Header) (int, map[string]any) {
	var reader io.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, reader)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	if key != "" {
		request.Header.Set("Idempotency-Key", key)
	}
	for _, header := range headers {
		for name, values := range header {
			request.Header[name] = values
		}
	}
	recorder := httptest.NewRecorder()
	harness.mux.ServeHTTP(recorder, request)
	decoded := map[string]any{}
	_ = json.Unmarshal(recorder.Body.Bytes(), &decoded)
	return recorder.Code, decoded
}

func TestTipsPayTheCreatorOnceAndShowInEarningsAndTheDashboard(t *testing.T) {
	fan, creator, stranger, blocked := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{
		Owners: map[string]string{"post:p1": creator, "clip:c1": stranger},
		Lives:  map[string]repositories.LiveSummary{"live-1": {Id: "live-1", HostId: creator, Title: "Friday live", State: "live"}, "live-disabled": {Id: "live-disabled", HostId: creator, State: "live"}, "live-old": {Id: "live-old", HostId: creator, State: "ended"}},
		Blocks: map[[2]string]bool{{blocked, creator}: true}, Followers: map[string]int64{creator: 42}, Applications: map[string]string{stranger: "pending"},
	})
	harness.makeCreator(creator, "top")
	harness.module.Container.Settings.Revenue.CoinTransferFeeBps = 200
	liveSchema := "tip_live_test_" + uuid.NewString()[:8]
	harness.module.Container.Settings.LiveSchema = liveSchema
	if _, err := harness.database.Exec(`CREATE SCHEMA ` + pgx.Identifier{liveSchema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if _, err := harness.database.Exec(`CREATE TABLE ` + pgx.Identifier{liveSchema, "live_sessions"}.Sanitize() + ` (id text PRIMARY KEY, host_id text NOT NULL, state text NOT NULL, gifts_enabled boolean NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	for _, live := range []struct {
		id, state string
		enabled   bool
	}{{"live-1", "live", true}, {"live-disabled", "live", false}, {"live-old", "ended", true}} {
		if _, err := harness.database.Exec(`INSERT INTO `+pgx.Identifier{liveSchema, "live_sessions"}.Sanitize()+` (id, host_id, state, gifts_enabled) VALUES ($1,$2,$3,$4)`, live.id, creator, live.state, live.enabled); err != nil {
			t.Fatal(err)
		}
	}
	harness.issueCoins(fan, 1_000)
	harness.issueCoins(blocked, 100)
	fanToken := harness.tokens.UserAccessToken(fan)
	tip := func(token, key, targetType, targetId string, coins int64) (int, map[string]any) {
		return harness.call(http.MethodPost, "/api/v1/tips", token, key, map[string]any{"targetType": targetType, "targetId": targetId, "coins": coins})
	}
	tipWithNote := func(token, key, targetType, targetId string, coins int64, note string) (int, map[string]any) {
		return harness.call(http.MethodPost, "/api/v1/tips", token, key, map[string]any{"targetType": targetType, "targetId": targetId, "coins": coins, "note": note})
	}
	if status, _ := tip(fanToken, "", "post", "p1", 10); status != http.StatusBadRequest {
		t.Fatalf("an Idempotency-Key is required: %d", status)
	}
	if status, body := tip(fanToken, "tip-not-creator", "clip", "c1", 10); status != http.StatusUnprocessableEntity || body["code"] != "RECIPIENT_CANNOT_RECEIVE_TIPS" {
		t.Fatalf("non-creators can't earn tips: %d %v", status, body)
	}
	if status, body := tip(harness.tokens.UserAccessToken(blocked), "tip-blocked-1", "post", "p1", 10); status != http.StatusUnprocessableEntity || body["code"] != "TIP_BLOCKED" {
		t.Fatalf("blocked: %d %v", status, body)
	}
	if status, body := tip(fanToken, "tip-ended-live", "live", "live-old", 10); status != http.StatusUnprocessableEntity || body["code"] != "LIVE_NOT_ACTIVE" {
		t.Fatalf("ended live: %d %v", status, body)
	}
	status, receipt := tipWithNote(fanToken, "tip-post-0001", "post", "p1", 100, "  Keep going!  ")
	if status != http.StatusCreated || receipt["balance"] != float64(900) || receipt["coinBalance"] != float64(900) {
		t.Fatalf("tip: %d %v", status, receipt)
	}
	if _, replay := tipWithNote(fanToken, "tip-post-0001", "post", "p1", 100, "Keep going!"); replay["tipId"] != receipt["tipId"] || replay["balance"] != float64(900) {
		t.Fatalf("a replay charges once: %v", replay)
	}
	if status, body := tipWithNote(fanToken, "tip-post-0001", "post", "p1", 100, "Changed message"); status != http.StatusConflict || body["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("changing note with an existing key must conflict: %d %v", status, body)
	}
	if status, body := tip(fanToken, "tip-post-0001", "post", "p1", 5); status != http.StatusConflict || body["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("key reuse: %d %v", status, body)
	}
	client := harness.module.Container.Client(harness.database)
	storedTip, err := client.TipTransaction.Query().Where(tiptransaction.IdempotencyKey("tip-post-0001")).Only(context.Background())
	if err != nil || storedTip.Note != "Keep going!" {
		t.Fatalf("normalized note must be durable on the tip transaction: tip=%+v err=%v", storedTip, err)
	}
	storedEvent, err := client.OutboxEvent.Query().Where(outboxevent.EventType("tip.sent")).Only(context.Background())
	if err != nil {
		t.Fatalf("tip recipient event should be enqueued: %v", err)
	}
	var eventPayload map[string]any
	if err := json.Unmarshal(storedEvent.Payload, &eventPayload); err != nil {
		t.Fatalf("tip recipient event payload must decode: %v", err)
	}
	eventData, _ := eventPayload["data"].(map[string]any)
	if eventPayload["type"] != "tip.sent" || eventData["note"] != "Keep going!" || eventData["creatorUserId"] != creator {
		t.Fatalf("tip recipient event should carry the bounded note: payload=%v", eventPayload)
	}
	if status, body := tipWithNote(fanToken, "tip-note-too-long", "post", "p1", 1, strings.Repeat("é", moneyservices.MaximumTipNoteRunes+1)); status != http.StatusBadRequest || body["code"] != "VALIDATION_FAILED" {
		t.Fatalf("controller must reject notes over the character limit: %d %v", status, body)
	}
	if status, body := tip(fanToken, "tip-too-much-1", "live", "live-1", 5_000); status != http.StatusUnprocessableEntity || body["code"] != "INSUFFICIENT_COINS" {
		t.Fatalf("no overdraft: %d %v", status, body)
	}
	if status, body := tip(fanToken, "tip-live-disabled", "live", "live-disabled", 100); status != http.StatusUnprocessableEntity || body["code"] != "LIVE_COIN_SUPPORT_DISABLED" {
		t.Fatalf("host opt-out must be enforced by the live tip service: %d %v", status, body)
	}
	if harness.balance(ledgermodels.UserSpendableCoinsAccount(fan)) != 900 {
		t.Fatal("disabled live coin support must not debit the sender")
	}
	status, liveReceipt := tip(fanToken, "tip-live-enabled", "live", "live-1", 100)
	if status != http.StatusCreated || liveReceipt["balance"] != float64(800) {
		t.Fatalf("enabled live tip: %d %v", status, liveReceipt)
	}
	if earned := harness.balance(ledgermodels.CreatorEarnedCoinsAccount(creator)); earned != 168 {
		t.Fatalf("profile tip keeps the existing top-tier split and live tip uses 2%%: %d", earned)
	}
	creatorToken := harness.tokens.UserAccessToken(creator)
	_, earnings := harness.call(http.MethodGet, "/api/v1/creators/earnings", creatorToken, "", nil)
	items := earnings["data"].([]any)
	if len(items) != 2 || items[0].(map[string]any)["kind"] != "tip" || items[0].(map[string]any)["source"] != "gift" {
		t.Fatalf("earnings: %v", earnings)
	}
	status, dashboard := harness.call(http.MethodGet, "/api/v1/creators/dashboard?period=week&currency=NGN", creatorToken, "", nil)
	breakdown := dashboard["earnings"].(map[string]any)
	if status != http.StatusOK || breakdown["tips"].(map[string]any)["amountMinor"] != float64(168_000) || dashboard["pendingBalance"].(map[string]any)["amountMinor"] != float64(168_000) {
		t.Fatalf("dashboard: %d %v", status, dashboard)
	}
	if status, _ := harness.call(http.MethodGet, "/api/v1/creators/dashboard?period=year", creatorToken, "", nil); status != http.StatusBadRequest {
		t.Fatalf("unknown period: %d", status)
	}
	if status, _ := harness.call(http.MethodGet, "/api/v1/creators/dashboard", fanToken, "", nil); status != http.StatusForbidden {
		t.Fatalf("dashboard is for creators: %d", status)
	}
	if _, me := harness.call(http.MethodGet, "/api/v1/creators/me", creatorToken, "", nil); me["status"] != "approved" || me["canGoLive"] != true || me["tier"] != "top" {
		t.Fatalf("me: %v", me)
	}
	if _, pending := harness.call(http.MethodGet, "/api/v1/creators/me", harness.tokens.UserAccessToken(stranger), "", nil); pending["status"] != "pending" || pending["canGoLive"] != false {
		t.Fatalf("pending applicant: %v", pending)
	}
	_, rules := harness.call(http.MethodGet, "/api/v1/creators/revenue-rules", fanToken, "", nil)
	if rules["subscriptionCreatorSharePercent"] != float64(80) || rules["giftCreatorSharePercentUpTo"] != float64(70) || rules["adsRevenueCreatorSharePercent"] != float64(40) {
		t.Fatalf("rules: %v", rules)
	}
	policy, ok := rules["adRevenuePolicy"].(map[string]any)
	if !ok || policy["baseShareBasisPoints"] != float64(4000) || len(policy["rules"].([]any)) != 2 {
		t.Fatalf("ad policy breakdown: %v", rules["adRevenuePolicy"])
	}
	assertHealthy(t, harness.creatorsHarness)
}

func TestAdRevenueShareAndSubscriptionEarningsPostOnce(t *testing.T) {
	creator := uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{})
	ctx, now := context.Background(), time.Now()
	posted := moneyservices.AdCreatorEarningsPosted{CreatorUserId: creator, Currency: "NGN", AmountMinor: 12_345, BatchId: "batch-1", IdempotencyKey: "adCreator:batch-1:" + creator}
	for range 2 {
		if err := harness.module.Money.PostAdRevenueShare(ctx, posted, now); err != nil {
			t.Fatal(err)
		}
	}
	if payable := harness.balance(ledgermodels.CreatorEarningsPayableAccount(creator, "NGN")); payable != 12_345 {
		t.Fatalf("ad share posted once: %d", payable)
	}
	paid := moneyservices.CreatorSubscriptionPaid{SubscriptionId: "s1", CreatorId: creator, Kind: "initial", Reference: "creator-subscription-charge:c1",
		Amount: moneyservices.Money{AmountMinor: 100_000, Currency: "NGN"}, CreatorShare: moneyservices.Money{AmountMinor: 78_800, Currency: "NGN"}}
	for range 2 {
		if err := harness.module.Money.RecordSubscriptionEarning(ctx, paid, now); err != nil {
			t.Fatal(err)
		}
	}
	harness.makeCreator(creator, "starter")
	_, earnings := harness.call(http.MethodGet, "/api/v1/creators/earnings", harness.tokens.UserAccessToken(creator), "", nil)
	if len(earnings["data"].([]any)) != 2 {
		t.Fatalf("one earning each: %v", earnings)
	}
	assertHealthy(t, harness.creatorsHarness)
}

func TestSuspensionRecordsAReasonAndAViolation(t *testing.T) {
	creator := uuid.NewString()
	harness := startHttpHarness(t, repositories.StaticCreatorsDirectory{})
	harness.makeCreator(creator, "starter")
	staff := harness.tokens.StaffTokens(uuid.NewString(), ledgerconstants.PermissionManageCreators)
	headers := http.Header{staffauth.StepUpHeader: {staff.StepUpToken}}
	path := "/api/v1/admin/creators/" + creator + "/program"
	if status, _ := harness.call(http.MethodPut, path, staff.AccessToken, "", map[string]any{"tierId": "starter", "status": "suspended"}, headers); status != http.StatusBadRequest {
		t.Fatalf("a suspension needs a reason: %d", status)
	}
	status, member := harness.call(http.MethodPut, path, staff.AccessToken, "", map[string]any{"tierId": "starter", "status": "suspended", "reason": "Fake giveaways"}, headers)
	if status != http.StatusOK || member["suspensionReason"] != "Fake giveaways" || member["suspendedAt"] == nil {
		t.Fatalf("suspend: %d %v", status, member)
	}
	_, violations := harness.call(http.MethodGet, "/api/v1/admin/creators/"+creator+"/violations", staff.AccessToken, "", nil)
	if len(violations["data"].([]any)) != 1 {
		t.Fatalf("violations: %v", violations)
	}
	if _, me := harness.call(http.MethodGet, "/api/v1/creators/me", harness.tokens.UserAccessToken(creator), "", nil); me["status"] != "suspended" || me["canGoLive"] != false || me["recentViolations"] != float64(1) {
		t.Fatalf("me while suspended: %v", me)
	}
	if _, reinstated := harness.call(http.MethodPut, path, staff.AccessToken, "", map[string]any{"tierId": "starter", "status": "approved"}, headers); reinstated["suspensionReason"] != "" {
		t.Fatalf("reinstated: %v", reinstated)
	}
}

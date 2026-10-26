package subscriptions

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/subscriptions/src/repositories"
)

func startCreatorSubscriptionsHarness(t *testing.T, creator, fan, blocked string) *subscriptionsHarness {
	identity := repositories.StaticIdentityDirectory{Accounts: map[string]repositories.AccountSignals{}}
	harness := startSubscriptionsHarness(t, identity)
	harness.module.Billing.Container.Creators = repositories.StaticCreatorDirectory{
		Creators: map[string]repositories.CreatorAccount{
			creator: {AccountId: creator, Approved: true, CountryCode: "NG"}, fan: {AccountId: fan}, blocked: {AccountId: blocked},
		},
		Blocks: map[[2]string]bool{{creator, blocked}: true},
		Users:  map[string]repositories.UserSummary{fan: {Id: fan, Username: "ada", Name: "Ada"}},
	}
	harness.OnboardConnectedAccount(creator, false)
	return harness
}

func (harness *subscriptionsHarness) creatorEarnings(creator string) int64 {
	balance, err := harness.Ledger.ReadAccountBalance(context.Background(), harness.Database, ledgermodels.CreatorEarningsPayableAccount(creator, "NGN"))
	if err != nil {
		harness.T.Fatal(err)
	}
	return balance
}

func TestCreatorSubscriptionChargesSharesRenewsAndEnds(t *testing.T) {
	creator, fan, blocked := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness := startCreatorSubscriptionsHarness(t, creator, fan, blocked)
	ctx := context.Background()
	creatorToken, fanToken := harness.Tokens.UserAccessToken(creator), harness.Tokens.UserAccessToken(fan)
	planBody := map[string]any{"name": "Fan club", "price": map[string]any{"amountMinor": 100_000, "currency": "NGN"}, "benefits": []any{"Shoutouts", map[string]any{"name": "Early access", "description": "See clips first"}}}
	if notCreator := harness.Call(http.MethodPost, "/api/v1/creators/me/subscription-plans", fanToken, "", planBody); notCreator.Status != http.StatusForbidden {
		t.Fatalf("only approved creators sell plans: %d %s", notCreator.Status, notCreator.Raw)
	}
	tooCheap := harness.Call(http.MethodPost, "/api/v1/creators/me/subscription-plans", creatorToken, "", map[string]any{"name": "Cheap", "price": map[string]any{"amountMinor": 10_000, "currency": "NGN"}})
	if tooCheap.Status != http.StatusUnprocessableEntity || tooCheap.Body["code"] != "PRICE_OUTSIDE_BANDS" {
		t.Fatalf("prices stay inside the regional bands: %d %s", tooCheap.Status, tooCheap.Raw)
	}
	created := harness.Call(http.MethodPost, "/api/v1/creators/me/subscription-plans", creatorToken, "", planBody)
	if created.Status != http.StatusCreated || created.Body["interval"] != "month" || len(created.Body["benefits"].([]any)) != 2 {
		t.Fatalf("create plan: %d %s", created.Status, created.Raw)
	}
	planId := created.Body["id"].(string)
	if public := harness.Call(http.MethodGet, "/api/v1/creators/"+creator+"/subscription-plans", "", "", nil); public.Status != http.StatusOK || len(public.Body["data"].([]any)) != 1 {
		t.Fatalf("plans are public: %d %s", public.Status, public.Raw)
	}
	subscribe := func(token, key string, headers ...http.Header) (int, map[string]any) {
		response := harness.Call(http.MethodPost, "/api/v1/creators/"+creator+"/subscriptions", token, key, map[string]any{"planId": planId}, headers...)
		return response.Status, response.Body
	}
	if status, _ := subscribe(fanToken, ""); status != http.StatusBadRequest {
		t.Fatalf("an Idempotency-Key is required: %d", status)
	}
	if status, body := subscribe(creatorToken, "self-subscribe-1"); status != http.StatusUnprocessableEntity || body["code"] != "CANNOT_SUBSCRIBE_TO_SELF" {
		t.Fatalf("self: %d %v", status, body)
	}
	if status, body := subscribe(harness.Tokens.UserAccessToken(blocked), "blocked-subscribe-1"); status != http.StatusUnprocessableEntity || body["code"] != "SUBSCRIPTION_BLOCKED" {
		t.Fatalf("blocked: %d %v", status, body)
	}
	if status, body := subscribe(fanToken, "app-subscribe-1", http.Header{"X-Client-Platform": {"ios"}}); status != http.StatusUnprocessableEntity || body["code"] != "WEB_BILLING_ONLY" {
		t.Fatalf("apps use store billing: %d %v", status, body)
	}
	status, started := subscribe(fanToken, "fan-subscribe-1")
	if status != http.StatusCreated || started["checkoutUrl"] == "" || !strings.HasPrefix(started["reference"].(string), "csub-") {
		t.Fatalf("checkout: %d %v", status, started)
	}
	if _, replay := subscribe(fanToken, "fan-subscribe-1"); replay["subscriptionId"] != started["subscriptionId"] {
		t.Fatalf("a replay returns the same checkout: %v", replay)
	}
	subscriptionId := started["subscriptionId"].(string)
	harness.PayCheckout(started["reference"].(string), 1_500, "card")
	state := harness.Call(http.MethodGet, "/api/v1/creator-subscriptions/"+subscriptionId, fanToken, "", nil)
	if state.Status != http.StatusOK || state.Body["status"] != "active" || state.Body["renewsAt"] == nil {
		t.Fatalf("paid subscription: %d %s", state.Status, state.Raw)
	}
	if webapp := harness.Call(http.MethodGet, "/api/v1/subscriptions/"+subscriptionId, fanToken, "", nil); webapp.Status != http.StatusOK || webapp.Body["planId"] != planId {
		t.Fatalf("the web return page reads the same state: %d %s", webapp.Status, webapp.Raw)
	}
	if earned := harness.creatorEarnings(creator); earned != 78_800 {
		t.Fatalf("the creator keeps 80%% of net: %d", earned)
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("s", 32)}}
	if access := harness.Call(http.MethodGet, "/api/v1/internal/entitlements/"+fan+"?creatorId="+creator, "", "", nil, internal); access.Body["subscribedToCreator"] != true {
		t.Fatalf("subscriber access: %s", access.Raw)
	}
	if status, body := subscribe(fanToken, "fan-subscribe-2"); status != http.StatusConflict || body["code"] != "ALREADY_SUBSCRIBED" {
		t.Fatalf("one live subscription per creator: %d %v", status, body)
	}
	subscribers := harness.Call(http.MethodGet, "/api/v1/creators/me/subscribers", creatorToken, "", nil)
	if items := subscribers.Body["data"].([]any); len(items) != 1 || items[0].(map[string]any)["planName"] != "Fan club" {
		t.Fatalf("subscribers: %s", subscribers.Raw)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	row := client.CreatorSubscription.GetX(ctx, uuid.MustParse(subscriptionId))
	firstEnd := *row.CurrentPeriodEnd
	harness.clock = firstEnd.Add(time.Minute)
	if renewed := harness.module.CreatorSubscriptions.RunDueRenewals(ctx, 10); renewed != 1 {
		t.Fatalf("one renewal: %d", renewed)
	}
	row = client.CreatorSubscription.GetX(ctx, row.ID)
	if row.Status.String() != "active" || !row.CurrentPeriodStart.Equal(firstEnd) || harness.creatorEarnings(creator) != 78_800+78_880 {
		t.Fatalf("renewal extends from the old period end and pays the creator: %s %v %d", row.Status, row.CurrentPeriodStart, harness.creatorEarnings(creator))
	}
	cancelled := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/"+subscriptionId+"/cancel", fanToken, "", nil)
	if cancelled.Status != http.StatusOK || cancelled.Body["status"] != "cancelled" || cancelled.Body["renewsAt"] != nil {
		t.Fatalf("cancel: %d %s", cancelled.Status, cancelled.Raw)
	}
	if resumed := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/"+subscriptionId+"/resume", fanToken, "", nil); resumed.Body["status"] != "active" {
		t.Fatalf("resume before the end: %s", resumed.Raw)
	}
	harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/"+subscriptionId+"/cancel", fanToken, "", nil)
	harness.clock = row.CurrentPeriodEnd.Add(time.Minute)
	harness.module.CreatorSubscriptions.RunDueRenewals(ctx, 10)
	if ended := client.CreatorSubscription.GetX(ctx, row.ID); ended.Status.String() != "expired" {
		t.Fatalf("a cancelled subscription ends without a charge: %s", ended.Status)
	}
	if late := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/"+subscriptionId+"/resume", fanToken, "", nil); late.Status != http.StatusConflict {
		t.Fatalf("an ended subscription can't resume: %d", late.Status)
	}
	harness.AssertLedgerHealthy()
}

func TestCreatorSubscriptionWithoutASavedCardFallsPastDueThenExpires(t *testing.T) {
	creator, fan := uuid.NewString(), uuid.NewString()
	harness := startCreatorSubscriptionsHarness(t, creator, fan, uuid.NewString())
	ctx := context.Background()
	created := harness.Call(http.MethodPost, "/api/v1/creators/me/subscription-plans", harness.Tokens.UserAccessToken(creator), "",
		map[string]any{"name": "Supporters", "price": map[string]any{"amountMinor": 50_000, "currency": "NGN"}, "benefits": []any{}})
	started := harness.Call(http.MethodPost, "/api/v1/creators/"+creator+"/subscriptions", harness.Tokens.UserAccessToken(fan), "bank-subscribe-1", map[string]any{"planId": created.Body["id"]})
	if started.Status != http.StatusCreated {
		t.Fatalf("checkout: %d %s", started.Status, started.Raw)
	}
	harness.PayCheckout(started.Body["reference"].(string), 0, "bank_transfer")
	verified := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/verify", harness.Tokens.UserAccessToken(fan), "", map[string]any{"reference": started.Body["reference"]})
	if verified.Status != http.StatusOK || verified.Body["status"] != "active" {
		t.Fatalf("verify: %d %s", verified.Status, verified.Raw)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	row := client.CreatorSubscription.GetX(ctx, uuid.MustParse(started.Body["subscriptionId"].(string)))
	harness.clock = row.CurrentPeriodEnd.Add(time.Minute)
	harness.module.CreatorSubscriptions.RunDueRenewals(ctx, 10)
	if pastDue := client.CreatorSubscription.GetX(ctx, row.ID); pastDue.Status.String() != "past_due" || pastDue.NextChargeAt == nil {
		t.Fatalf("a failed renewal is retried while past due: %s", pastDue.Status)
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("s", 32)}}
	if access := harness.Call(http.MethodGet, "/api/v1/internal/entitlements/"+fan+"?creatorId="+creator, "", "", nil, internal); access.Body["subscribedToCreator"] != false {
		t.Fatalf("access stops at the period end while past due: %s", access.Raw)
	}
	harness.clock = row.CurrentPeriodEnd.Add(4 * 24 * time.Hour)
	harness.module.CreatorSubscriptions.RunDueRenewals(ctx, 10)
	if ended := client.CreatorSubscription.GetX(ctx, row.ID); ended.Status.String() != "expired" {
		t.Fatalf("past due expires after the grace period: %s", ended.Status)
	}
	harness.AssertLedgerHealthy()
}

package subscriptions_test

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/subscriptions/src/generated/ent/creatorsubscriptioncharge"
	"nantty/modules/subscriptions/src/repositories"
)

type fakeCreatorStore struct {
	store    string
	mutex    sync.Mutex
	receipts map[string]interfaces.VerifiedStorePurchase
}

func (fake *fakeCreatorStore) Store() string              { return fake.store }
func (fake *fakeCreatorStore) StoreFeeBasisPoints() int64 { return 9_999 }

func (fake *fakeCreatorStore) VerifyPurchaseReceipt(_ context.Context, receipt interfaces.StoreReceipt) (interfaces.VerifiedStorePurchase, error) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	verified, found := fake.receipts[receipt.ReceiptData]
	if !found {
		return interfaces.VerifiedStorePurchase{}, interfaces.ErrStoreReceiptInvalid
	}
	return verified, nil
}

type fakeStoreNotice struct {
	Id, Kind, Transaction, Original, Product, Token string
	Price                                           int64
	Expires                                         time.Time
}

func (fake *fakeCreatorStore) VerifySignedRefundNotification(_ context.Context, rawBody []byte, _ http.Header) (interfaces.StoreRefundNotification, error) {
	var notice fakeStoreNotice
	if json.Unmarshal(rawBody, &notice) != nil {
		return interfaces.StoreRefundNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	converted := interfaces.StoreRefundNotification{
		NotificationId: notice.Id, Kind: interfaces.StoreNotificationKind(notice.Kind), StoreTransactionId: notice.Transaction,
		OriginalTransactionId: notice.Original, ProductId: notice.Product, AccountToken: notice.Token,
	}
	if notice.Kind == "renewed" {
		converted.Transaction = &interfaces.VerifiedStorePurchase{
			StoreTransactionId: notice.Transaction, OriginalTransactionId: notice.Original, ProductId: notice.Product, PriceMinor: notice.Price, Currency: "NGN",
			Environment: "sandbox", PurchasedAt: notice.Expires.AddDate(0, -1, 0), ExpiresAt: &notice.Expires, IsSubscription: true, AccountToken: notice.Token,
		}
		converted.ExpiresAt = &notice.Expires
	}
	return converted, nil
}

func (fake *fakeCreatorStore) remember(receipt string, verified interfaces.VerifiedStorePurchase) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.receipts[receipt] = verified
}

func TestCreatorSubscriptionBoughtInTheAppStoreRenewsAndClawsBackOnRefund(t *testing.T) {
	creator, otherCreator, fan := uuid.NewString(), uuid.NewString(), uuid.NewString()
	apple := &fakeCreatorStore{store: "apple_iap", receipts: map[string]interfaces.VerifiedStorePurchase{}}
	harness := startSubscriptionsHarnessWithStores(t, repositories.StaticIdentityDirectory{Accounts: map[string]repositories.AccountSignals{}}, map[string]interfaces.StoreReceiptVerifier{"apple_iap": apple})
	harness.module.Billing.Container.Creators = repositories.StaticCreatorDirectory{Creators: map[string]repositories.CreatorAccount{
		creator: {AccountId: creator, Approved: true, CountryCode: "NG"}, otherCreator: {AccountId: otherCreator, Approved: true, CountryCode: "NG"}, fan: {AccountId: fan},
	}}
	ctx := context.Background()
	fanToken := harness.Tokens.UserAccessToken(fan)
	harness.OnboardConnectedAccount(creator, false)
	harness.OnboardConnectedAccount(otherCreator, false)
	createPlan := func(owner string, amount int64) map[string]any {
		response := harness.Call(http.MethodPost, "/api/v1/creators/me/subscription-plans", harness.Tokens.UserAccessToken(owner), "", map[string]any{"name": "Club", "price": map[string]any{"amountMinor": amount, "currency": "NGN"}})
		if amount == 120_000 {
			if response.Status != http.StatusUnprocessableEntity || response.Body["code"] != "PRICE_NOT_A_TIER" {
				t.Fatalf("₦1,200 is between tiers: %d %s", response.Status, response.Raw)
			}
			return nil
		}
		if response.Status != http.StatusCreated {
			t.Fatalf("create plan %d %s", response.Status, response.Raw)
		}
		return response.Body
	}
	createPlan(creator, 120_000)
	planId := createPlan(creator, 100_000)["id"].(string)
	otherPlanId := createPlan(otherCreator, 100_000)["id"].(string)

	tiers := harness.Call(http.MethodGet, "/api/v1/creators/me/subscription-plans/price-tiers?currency=NGN", harness.Tokens.UserAccessToken(creator), "", nil)
	if tiers.Status != http.StatusOK || len(tiers.Body["data"].([]any)) != 7 {
		t.Fatalf("price tiers %d %s", tiers.Status, tiers.Raw)
	}
	for channel, want := range map[string]float64{"ios": 150_000, "android": 120_000, "web": 100_000} {
		listed := harness.Call(http.MethodGet, "/api/v1/creators/"+creator+"/subscription-plans?channel="+channel, "", "", nil)
		plan := listed.Body["data"].([]any)[0].(map[string]any)
		if plan["channelPrice"].(map[string]any)["amountMinor"] != want || plan["tier"] != "1000" {
			t.Fatalf("%s price %s", channel, listed.Raw)
		}
		if (channel == "web") != (plan["storeProductId"] == nil) {
			t.Fatalf("%s product id %v", channel, plan["storeProductId"])
		}
	}
	if android := harness.Call(http.MethodPost, "/api/v1/creators/"+creator+"/subscriptions/store", fanToken, "android-1", map[string]any{"planId": planId, "platform": "android"}); android.Status != http.StatusServiceUnavailable {
		t.Fatalf("an unconfigured store refuses before the fan pays: %d %s", android.Status, android.Raw)
	}
	start := func(creatorId, plan, key string) map[string]any {
		key = "intent-" + key
		response := harness.Call(http.MethodPost, "/api/v1/creators/"+creatorId+"/subscriptions/store", fanToken, key, map[string]any{"planId": plan, "platform": "ios"})
		if response.Status != http.StatusCreated {
			t.Fatalf("store intent %d %s", response.Status, response.Raw)
		}
		return response.Body
	}
	intent := start(creator, planId, "k1")
	subscriptionId := intent["subscriptionId"].(string)
	if intent["productId"] != "nantty.creatorsub.tier_1000.s1.monthly" || intent["appAccountToken"] != subscriptionId || start(creator, planId, "k1")["subscriptionId"] != subscriptionId {
		t.Fatalf("intent %v", intent)
	}

	periodEnd := harness.clock.AddDate(0, 1, 0).Truncate(time.Second)
	apple.remember("receipt-1", interfaces.VerifiedStorePurchase{
		StoreTransactionId: "t1", OriginalTransactionId: "o1", ProductId: "nantty.creatorsub.tier_1000.s1.monthly", PriceMinor: 150_000, Currency: "NGN",
		Environment: "sandbox", PurchasedAt: harness.clock, ExpiresAt: &periodEnd, IsSubscription: true, AccountToken: subscriptionId,
	})
	redeem := func(key string) map[string]any {
		key = "receipt-" + key
		response := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/store-receipts", fanToken, key,
			map[string]any{"platform": "ios", "productId": "nantty.creatorsub.tier_1000.s1.monthly", "receipt": "receipt-1", "transactionId": "t1"})
		if response.Status != http.StatusOK {
			t.Fatalf("redeem %d %s", response.Status, response.Raw)
		}
		return response.Body
	}
	if state := redeem("r1"); state["status"] != "active" || state["billingChannel"] != "apple_iap" {
		t.Fatalf("activated %v", state)
	}
	redeem("r2")
	if earned := harness.creatorEarnings(creator); earned != 84_000 {
		t.Fatalf("80%% of ₦1,500 minus the 30%% store fee is ₦840 once, got %d", earned)
	}
	intruder := harness.Tokens.UserAccessToken(uuid.NewString())
	stolen := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/store-receipts", intruder, "receipt-intruder",
		map[string]any{"platform": "ios", "productId": "nantty.creatorsub.tier_1000.s1.monthly", "receipt": "receipt-1", "transactionId": "t1"})
	if stolen.Status != http.StatusUnprocessableEntity || stolen.Body["code"] != "STORE_PURCHASE_NOT_LINKED" {
		t.Fatalf("someone else's receipt is refused: %d %s", stolen.Status, stolen.Raw)
	}
	pricier := periodEnd
	apple.remember("receipt-wrong-tier", interfaces.VerifiedStorePurchase{
		StoreTransactionId: "t-wrong", OriginalTransactionId: "o1", ProductId: "nantty.creatorsub.tier_500.s1.monthly", PriceMinor: 80_000, Currency: "NGN",
		PurchasedAt: harness.clock, ExpiresAt: &pricier, IsSubscription: true, AccountToken: subscriptionId,
	})
	if cheaper := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/store-receipts", fanToken, "receipt-wrong-tier",
		map[string]any{"platform": "ios", "productId": "nantty.creatorsub.tier_500.s1.monthly", "receipt": "receipt-wrong-tier"}); cheaper.Body["code"] != "STORE_RECEIPT_MISMATCH" {
		t.Fatalf("a cheaper tier can't unlock this plan: %d %s", cheaper.Status, cheaper.Raw)
	}
	if earned := harness.creatorEarnings(creator); earned != 84_000 {
		t.Fatalf("refused receipts post nothing, got %d", earned)
	}
	if second := start(otherCreator, otherPlanId, "k2"); second["productId"] != "nantty.creatorsub.tier_1000.s2.monthly" {
		t.Fatalf("a second creator at the same tier takes the next slot: %v", second)
	}
	if cancel := harness.Call(http.MethodPost, "/api/v1/creator-subscriptions/"+subscriptionId+"/cancel", fanToken, "", nil); cancel.Body["code"] != "MANAGE_IN_STORE" {
		t.Fatalf("store subscriptions are managed in the store: %d %s", cancel.Status, cancel.Raw)
	}

	notify := func(notice fakeStoreNotice) {
		notice.Original, notice.Product = "o1", "nantty.creatorsub.tier_1000.s1.monthly"
		raw, _ := json.Marshal(notice)
		if response := harness.Call(http.MethodPost, "/webhooks/store-notifications/apple_iap", "", "", raw); response.Status != http.StatusOK {
			t.Fatalf("notification %s: %d %s", notice.Kind, response.Status, response.Raw)
		}
	}
	state := func() map[string]any {
		return harness.Call(http.MethodGet, "/api/v1/creator-subscriptions/"+subscriptionId, fanToken, "", nil).Body
	}
	renewedUntil := periodEnd.AddDate(0, 1, 0)
	renewal := fakeStoreNotice{Id: "n-renew", Kind: "renewed", Transaction: "t2", Price: 150_000, Expires: renewedUntil}
	notify(renewal)
	notify(renewal)
	if earned := harness.creatorEarnings(creator); earned != 168_000 {
		t.Fatalf("one renewal posts once, got %d", earned)
	}
	if end, _ := time.Parse(time.RFC3339, state()["currentPeriodEnd"].(string)); !end.Equal(renewedUntil) {
		t.Fatalf("renewal extends to the store expiry, got %v", end)
	}
	for _, step := range []struct{ kind, want string }{{"cancelled", "cancelled"}, {"resumed", "active"}, {"renewalFailed", "past_due"}, {"grace", "past_due"}} {
		notify(fakeStoreNotice{Id: "n-" + step.kind, Kind: step.kind})
		if got := state()["status"]; got != step.want {
			t.Fatalf("%s should leave %s, got %v", step.kind, step.want, got)
		}
	}

	withdrawCreatorEarnings(t, harness, creator, 150_000)
	notify(fakeStoreNotice{Id: "n-refund", Kind: "refund", Transaction: "t2"})
	notify(fakeStoreNotice{Id: "n-refund", Kind: "refund", Transaction: "t2"})
	if earned := harness.creatorEarnings(creator); earned != 0 {
		t.Fatalf("the refund takes back what is left, got %d", earned)
	}
	debt, _ := harness.Ledger.ReadAccountBalance(ctx, harness.Database, ledgermodels.CreatorEarningsDebtAccount(creator, "NGN"))
	if debt != 66_000 {
		t.Fatalf("the rest of the ₦840 share becomes creator debt, got %d", debt)
	}
	refunded, _ := harness.module.Billing.Container.Client(harness.Database).CreatorSubscriptionCharge.Query().Where(creatorsubscriptioncharge.StatusEQ(creatorsubscriptioncharge.StatusRefunded)).Count(ctx)
	if refunded != 1 || state()["status"] != "expired" {
		t.Fatalf("refund ends access: %d refunded, %v", refunded, state()["status"])
	}
	notify(fakeStoreNotice{Id: "n-expired", Kind: "expired"})
	if got := state()["status"]; got != "expired" {
		t.Fatalf("a late expiry keeps the refunded subscription expired, got %v", got)
	}
}

func withdrawCreatorEarnings(t *testing.T, harness *subscriptionsHarness, creator string, amount int64) {
	t.Helper()
	transaction, err := harness.Database.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	_, err = harness.Ledger.PostBalancedJournalEntry(context.Background(), transaction, ledgermodels.JournalEntryRequest{
		Reference: "test-withdrawal:" + creator, Kind: "test.withdrawal", Description: "creator withdrew",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.CreatorEarningsPayableAccount(creator, "NGN"), Direction: ledgermodels.Debit, AmountMinor: amount},
			{Account: ledgermodels.PlatformProviderBalanceAccount("flutterwave", "NGN"), Direction: ledgermodels.Credit, AmountMinor: amount},
		},
	})
	if err != nil {
		_ = transaction.Rollback()
		t.Fatal(err)
	}
	if err := transaction.Commit(); err != nil {
		t.Fatal(err)
	}
}

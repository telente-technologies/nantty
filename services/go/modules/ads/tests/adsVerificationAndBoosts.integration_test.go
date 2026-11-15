package ads_test

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	src "nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/interfaces"
	"nantty/modules/ads/src/jobs"
)

type fakeMoneyAccounts struct {
	mutex    sync.Mutex
	levels   map[string]int
	premium  map[string]bool
	fundings map[string]int64
	charged  map[string]int64
}

func newFakeMoneyAccounts() *fakeMoneyAccounts {
	return &fakeMoneyAccounts{levels: map[string]int{}, premium: map[string]bool{}, fundings: map[string]int64{}, charged: map[string]int64{}}
}

func (money *fakeMoneyAccounts) ReadVerificationLevel(_ context.Context, userId string) (interfaces.VerificationStatus, error) {
	money.mutex.Lock()
	defer money.mutex.Unlock()
	return interfaces.VerificationStatus{Level: money.levels[userId], NextStep: "payout_setup"}, nil
}

func (money *fakeMoneyAccounts) IsPremium(_ context.Context, userId string) (bool, error) {
	money.mutex.Lock()
	defer money.mutex.Unlock()
	return money.premium[userId], nil
}

func (money *fakeMoneyAccounts) FundAdAccountFromEarnings(_ context.Context, userId, _, currency string, amountMinor int64, key string) (interfaces.EarningsFundingResult, error) {
	money.mutex.Lock()
	defer money.mutex.Unlock()
	if money.levels[userId] < 1 {
		return interfaces.EarningsFundingResult{}, adserrors.VerificationRequired
	}
	if amountMinor > 2_000_000 {
		return interfaces.EarningsFundingResult{}, adserrors.InsufficientEarnings
	}
	money.fundings[key] = amountMinor
	return interfaces.EarningsFundingResult{FundingId: "funding-" + key[len(key)-8:], AmountMinor: amountMinor, Currency: currency}, nil
}

func withMoneyAccounts(money *fakeMoneyAccounts, topUps interfaces.TopUpGateway) harnessOption {
	return func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.Verification, collaborators.Entitlements, collaborators.Earnings, collaborators.TopUps = money, money, money, topUps
		collaborators.Funding = integrations.NewInMemoryFundingGateway()
	}
}

func boostBody(method string, dailyMinor int64, days int) map[string]any {
	return map[string]any{"postId": "post-" + uuid.NewString()[:8], "goal": "views", "audience": map[string]any{"mode": "automatic"},
		"dailyBudget": map[string]any{"amountMinor": dailyMinor, "currency": "NGN"}, "durationDays": days, "paymentMethod": method}
}

func TestOnlyPayoutVerifiedUsersCanAdvertiseAndFundAdsFromEarnings(t *testing.T) {
	money := newFakeMoneyAccounts()
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}))
	advertiser := h.newUser("ada")
	accountBody := map[string]any{"name": "Ada Shop", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}
	refused := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "verify-account-1", accountBody, http.StatusForbidden)
	if refused["code"] != "VERIFICATION_REQUIRED" || refused["message"] == "" {
		t.Fatalf("unverified ad account creation: %v", refused)
	}
	if status := h.expect("GET", "/api/v1/ads/verification", &advertiser, "", nil, http.StatusOK); status["verified"] != false || status["message"] == nil {
		t.Fatalf("verification status: %v", status)
	}
	money.levels[advertiser.id.String()] = 1
	account := h.expect("POST", "/api/v1/ads/accounts", &advertiser, "verify-account-2", accountBody, http.StatusCreated)
	accountId := account["id"].(string)
	funded := h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/billing/fund-from-earnings", &advertiser, "fund-earnings-0001", map[string]any{"amount": map[string]any{"amountMinor": 500_000, "currency": "NGN"}}, http.StatusCreated)
	if funded["status"] != "succeeded" {
		t.Fatalf("fund from earnings: %v", funded)
	}
	event := `{"id":"` + uuid.NewString() + `","type":"adBalance.toppedUp","occurredAt":"2026-10-05T10:00:00Z","data":{"adAccountId":"` + accountId + `","topUpId":"` + funded["fundingId"].(string) + `","source":"earnings","amount":{"amountMinor":500000,"currency":"NGN"}}}`
	if err := jobs.HandleDomainEventMessage(h.module.Container)(context.Background(), []byte(event)); err != nil {
		t.Fatal(err)
	}
	overview := h.expect("GET", "/api/v1/ads/accounts/"+accountId+"/billing", &advertiser, "", nil, http.StatusOK)
	if balance := overview["balance"].(map[string]any)["amountMinor"].(float64); balance != 500_000 {
		t.Fatalf("earnings funding must credit the account once even when the event arrives too: %v", overview)
	}
	if poor := h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/billing/fund-from-earnings", &advertiser, "fund-earnings-0002", map[string]any{"amount": map[string]any{"amountMinor": 3_000_000, "currency": "NGN"}}, http.StatusUnprocessableEntity); poor["code"] != "INSUFFICIENT_FUNDS" {
		t.Fatalf("insufficient earnings: %v", poor)
	}
	money.levels[advertiser.id.String()] = 0
	if lapsed := h.expect("POST", "/api/v1/ads/accounts/"+accountId+"/billing/fund-from-earnings", &advertiser, "fund-earnings-0003", map[string]any{"amount": map[string]any{"amountMinor": 100_000, "currency": "NGN"}}, http.StatusForbidden); lapsed["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("lapsed verification: %v", lapsed)
	}
}

func TestPremiumUsersGetOneFreeBoostAMonthAndAppsCannotSpendTheBalance(t *testing.T) {
	money := newFakeMoneyAccounts()
	topUps := &fakeTopUps{status: "pending"}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, topUps))
	member := h.newUser("tolu")
	money.premium[member.id.String()] = true
	options := h.expect("GET", "/api/v1/ads/boosts/options", &member, "", nil, http.StatusOK)
	free := options["freeBoost"].(map[string]any)
	if free["eligible"] != true || free["remainingThisMonth"].(float64) != 1 || len(options["paymentMethods"].([]any)) != 3 {
		t.Fatalf("premium options: %v", options)
	}
	if tooBig := h.expect("POST", "/api/v1/ads/boosts", &member, "free-boost-big-01", boostBody("free", 100_000, 3), http.StatusUnprocessableEntity); tooBig["code"] != "FREE_BOOST_TOO_LARGE" {
		t.Fatalf("free boost above the cap: %v", tooBig)
	}
	created := h.expect("POST", "/api/v1/ads/boosts", &member, "free-boost-0001", boostBody("free", 100_000, 1), http.StatusCreated)
	if boost := created["boost"].(map[string]any); boost["status"] != "in_review" || boost["paymentMethod"] != "free" || created["checkoutUrl"] != nil {
		t.Fatalf("free boost: %v", created)
	}
	if used := h.expect("POST", "/api/v1/ads/boosts", &member, "free-boost-0002", boostBody("free", 100_000, 1), http.StatusConflict); used["code"] != "FREE_BOOST_USED" {
		t.Fatalf("second free boost: %v", used)
	}
	if after := h.expect("GET", "/api/v1/ads/boosts/options", &member, "", nil, http.StatusOK)["freeBoost"].(map[string]any); after["eligible"] != false || after["remainingThisMonth"].(float64) != 0 {
		t.Fatalf("allowance after use: %v", after)
	}
	other := h.newUser("bayo")
	if notPremium := h.expect("POST", "/api/v1/ads/boosts", &other, "free-boost-0003", boostBody("free", 100_000, 1), http.StatusForbidden); notPremium["code"] != "FREE_BOOST_NOT_AVAILABLE" {
		t.Fatalf("free boost without premium: %v", notPremium)
	}
	if unverified := h.expect("POST", "/api/v1/ads/boosts", &other, "balance-boost-01", boostBody("balance", 100_000, 1), http.StatusForbidden); unverified["code"] != "VERIFICATION_REQUIRED" {
		t.Fatalf("balance boost below L1: %v", unverified)
	}
	card := h.expect("POST", "/api/v1/ads/boosts", &other, "card-boost-0001", boostBody("card", 100_000, 3), http.StatusCreated)
	if card["checkoutUrl"] != "https://checkout.flutterwave.test/abc" || card["boost"].(map[string]any)["status"] != "pending_payment" {
		t.Fatalf("card boost: %v", card)
	}
	topUpEvent := `{"id":"` + uuid.NewString() + `","type":"adBalance.toppedUp","occurredAt":"2026-10-05T10:00:00Z","data":{"adAccountId":"` + topUps.started[0].AdAccountId + `","topUpId":"money-top-up-1","amount":{"amountMinor":300000,"currency":"NGN"}}}`
	if err := jobs.HandleDomainEventMessage(h.module.Container)(context.Background(), []byte(topUpEvent)); err != nil {
		t.Fatal(err)
	}
	paid := h.expect("GET", "/api/v1/ads/boosts/"+card["boost"].(map[string]any)["id"].(string), &other, "", nil, http.StatusOK)
	if paid["status"] != "in_review" {
		t.Fatalf("a paid card boost must go to review: %v", paid)
	}
}

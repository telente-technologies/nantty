package subscriptions

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/generated/ent/outboxevent"
	"nantty/modules/subscriptions/src/generated/ent/subscriptioncoveredprofile"
	"nantty/modules/subscriptions/src/repositories"
)

type combinedGoldOwner struct {
	offerAccount
	businesses []string
	premiumId  uuid.UUID
}

func startCombinedGoldHarness(t *testing.T, businesses int) (*subscriptionsHarness, combinedGoldOwner) {
	t.Helper()
	owner := combinedGoldOwner{offerAccount: offerAccount{userId: uuid.NewString(), profileId: uuid.NewString()}}
	identity := repositories.StaticIdentityDirectory{
		Profiles:  map[string]repositories.BillingProfile{owner.profileId: {ProfileId: owner.profileId, OwnerUserId: owner.userId, ProfileType: "personal", DisplayName: "Ada", CountryCode: "NG"}},
		Accounts:  map[string]repositories.AccountSignals{owner.userId: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: owner.userId + "@example.com"}},
		Countries: map[string]string{owner.userId: "NG"},
	}
	for index := 0; index < businesses; index++ {
		profileId := uuid.NewString()
		profileType := "business"
		if index == businesses-1 {
			profileType = "brand"
		}
		identity.Profiles[profileId] = repositories.BillingProfile{ProfileId: profileId, OwnerUserId: owner.userId, ProfileType: profileType, DisplayName: "Ada Business", CountryCode: "NG"}
		owner.businesses = append(owner.businesses, profileId)
	}
	harness := startSubscriptionsHarness(t, identity)
	owner.token = harness.Tokens.UserAccessToken(owner.userId)
	listed, _ := identity.ListBusinessProfilesOfAccount(context.Background(), owner.userId)
	owner.businesses = owner.businesses[:0]
	for _, profile := range listed {
		owner.businesses = append(owner.businesses, profile.ProfileId)
	}
	return harness, owner
}

func (harness *subscriptionsHarness) givePremium(owner *combinedGoldOwner) {
	client := harness.module.Billing.Container.Client(harness.Database)
	row := client.Subscription.Create().SetProfileID(owner.profileId).SetProfileType("personal").SetOwnerUserID(owner.userId).SetPlanCode("premium").SetInterval("month").
		SetChannel("apple_iap").SetStatus("active").SetListAmountMinor(800_000).SetAmountMinor(800_000).SetCurrency("NGN").SetCreatedAt(time.Now()).SaveX(context.Background())
	owner.premiumId = row.ID
}

func (harness *subscriptionsHarness) combinedGold(owner combinedGoldOwner, path string, body map[string]any) map[string]any {
	harness.T.Helper()
	response := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/"+path, owner.token, "", body, http.Header{"X-Client-Platform": {"web"}})
	if response.Status != http.StatusOK && response.Status != http.StatusCreated {
		harness.T.Fatalf("%s: %d %s", path, response.Status, response.Raw)
	}
	return response.Body
}

func amountOf(body map[string]any, key string) float64 {
	return body[key].(map[string]any)["amountMinor"].(float64)
}

func TestCombinedGoldNeedsPremiumAndPricesTheTiersOnTheServer(t *testing.T) {
	harness, owner := startCombinedGoldHarness(t, 6)
	ctx := context.Background()
	three := map[string]any{"profileIds": owner.businesses[:3], "interval": "month"}
	if locked := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/quote", owner.token, "", three); locked.Status != http.StatusForbidden || locked.Body["code"] != "PREMIUM_REQUIRED" {
		t.Fatalf("no Premium, no combined plan: %d %s", locked.Status, locked.Raw)
	}
	harness.givePremium(&owner)
	for count, total := range map[int]float64{1: 285_000, 2: 540_000, 3: 792_000, 4: 1_032_000, 5: 1_260_000} {
		quote := harness.combinedGold(owner, "quote", map[string]any{"profileIds": owner.businesses[:count], "interval": "month"})
		if amountOf(quote, "total") != total || amountOf(quote, "unitMonthlyPrice") != 300_000 || len(quote["profiles"].([]any)) != count {
			t.Fatalf("%d profiles: %v", count, quote)
		}
	}
	yearly := harness.combinedGold(owner, "quote", map[string]any{"profileIds": owner.businesses[:3], "interval": "year"})
	breakdown := yearly["breakdown"].(map[string]any)
	if amountOf(yearly, "total") != 9_028_800 || breakdown["yearlyExtraDiscountMinor"].(float64) != 475_200 || breakdown["standardYearlyDiscountMinor"].(float64) != 0 {
		t.Fatalf("owner's worked example, ₦90,288 a year: %v", yearly)
	}
	six := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/quote", owner.token, "", map[string]any{"profileIds": owner.businesses, "interval": "month"})
	if six.Status != http.StatusBadRequest && six.Status != http.StatusUnprocessableEntity {
		t.Fatalf("six businesses can't be covered: %d %s", six.Status, six.Raw)
	}
	stranger := map[string]any{"profileIds": []string{uuid.NewString()}, "interval": "month"}
	if other := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/quote", owner.token, "", stranger); other.Body["code"] != "COMBINED_GOLD_PROFILES_INVALID" {
		t.Fatalf("someone else's profile: %d %s", other.Status, other.Raw)
	}
	duplicate := map[string]any{"profileIds": []string{owner.businesses[0], owner.businesses[0]}, "interval": "month"}
	if twice := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/quote", owner.token, "", duplicate); twice.Body["code"] != "COMBINED_GOLD_PROFILES_INVALID" {
		t.Fatalf("the same profile twice: %d %s", twice.Status, twice.Raw)
	}
	client := harness.module.Billing.Container.Client(harness.Database)
	if quote, _, err := harness.module.Billing.QuoteForOwner(ctx, client, owner.userId, "gold_only", "NG", "month"); err != nil || quote.DiscountKind == "bundle" {
		t.Fatalf("Premium owners get the combined plan instead of the Blue + Gold bundle: %+v %v", quote, err)
	}
	forged := map[string]any{"profileIds": owner.businesses[:3], "interval": "month", "amountMinor": 1}
	if response := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/checkout", owner.token, "", forged); response.Status != http.StatusBadRequest && response.Status != http.StatusUnprocessableEntity {
		t.Fatalf("a client amount is never accepted: %d %s", response.Status, response.Raw)
	}
	stale := map[string]any{"profileIds": owner.businesses[:3], "interval": "month", "expectedTotalMinor": 1}
	if response := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/checkout", owner.token, "", stale); response.Status != http.StatusConflict || response.Body["code"] != "PRICE_CHANGED" {
		t.Fatalf("a total the server didn't quote is refused: %d %s", response.Status, response.Raw)
	}
	if app := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/checkout", owner.token, "", three, http.Header{"X-Client-Platform": {"ios"}}); app.Status == http.StatusCreated {
		t.Fatal("combined Gold is web checkout only")
	}
	generic := map[string]any{"profileId": owner.profileId, "planCode": "gold_combined"}
	if response := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", owner.token, "", generic); response.Body["code"] != "USE_COMBINED_GOLD_CHECKOUT" {
		t.Fatalf("the generic checkout can't sell the combined plan: %d %s", response.Status, response.Raw)
	}
}

func TestOfferLinksDontStackWithTheCombinedDiscountTheBestOneWins(t *testing.T) {
	harness, owner := startCombinedGoldHarness(t, 3)
	harness.givePremium(&owner)
	_, weakToken := harness.createOfferLink(percentOffer(10, 1, "gold_combined"))
	weak := harness.combinedGold(owner, "quote", map[string]any{"profileIds": owner.businesses, "interval": "month", "offerClaimId": harness.reserveOffer(owner.offerAccount, weakToken)})
	if amountOf(weak, "total") != 792_000 || weak["discount"].(map[string]any)["discountKind"] != "multi_business" {
		t.Fatalf("12%% beats a 10%% offer: %v", weak)
	}
	_, strongToken := harness.createOfferLink(percentOffer(30, 1, "gold_combined"))
	strong := harness.combinedGold(owner, "quote", map[string]any{"profileIds": owner.businesses, "interval": "month", "offerClaimId": harness.reserveOffer(owner.offerAccount, strongToken)})
	if amountOf(strong, "total") != 630_000 || strong["discount"].(map[string]any)["discountKind"] != "offer" || len(strong["lineItems"].([]any)) != 2 {
		t.Fatalf("a 30%% offer replaces the tier, never stacks: %v", strong)
	}
}

func TestBusinessAlreadyOnItsOwnGoldCantJoinAndCoveredBusinessCantBuyGoldAlone(t *testing.T) {
	harness, owner := startCombinedGoldHarness(t, 3)
	harness.givePremium(&owner)
	client := harness.module.Billing.Container.Client(harness.Database)
	ctx := context.Background()
	client.Subscription.Create().SetProfileID(owner.businesses[2]).SetProfileType("business").SetOwnerUserID(owner.userId).SetPlanCode("gold_only").SetInterval("month").
		SetChannel("web_checkout").SetStatus("active").SetListAmountMinor(300_000).SetAmountMinor(300_000).SetCurrency("NGN").SetCreatedAt(time.Now()).ExecX(ctx)
	body := map[string]any{"profileIds": owner.businesses, "interval": "month", "returnTo": "https://zudomart.com/pay/return"}
	if response := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/checkout", owner.token, "", body); response.Body["code"] != "PROFILE_ALREADY_HAS_GOLD" {
		t.Fatalf("a business with its own Gold: %d %s", response.Status, response.Raw)
	}
	started := harness.combinedGold(owner, "checkout", map[string]any{"profileIds": owner.businesses[:2], "interval": "month", "expectedTotalMinor": 540_000})
	harness.PayCheckout(started["reference"].(string), 50, "card")
	alone := map[string]any{"profileId": owner.businesses[0], "planId": "gold_only_monthly"}
	if response := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", owner.token, "", alone, http.Header{"X-Client-Platform": {"web"}}); response.Body["code"] != "PROFILE_COVERED_BY_COMBINED_GOLD" {
		t.Fatalf("a covered business can't buy Gold again: %d %s", response.Status, response.Raw)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/subscriptions/gold-for-businesses/checkout", owner.token, "", body); again.Status != http.StatusConflict {
		t.Fatalf("one combined plan per owner: %d %s", again.Status, again.Raw)
	}
	covered, _ := client.SubscriptionCoveredProfile.Query().Where(subscriptioncoveredprofile.StatusEQ(subscriptioncoveredprofile.StatusActive)).Count(ctx)
	if covered != 2 {
		t.Fatalf("covered: %d", covered)
	}
}

func grantedSubjects(harness *subscriptionsHarness, eventType string) map[string]int {
	client := harness.module.Billing.Container.Client(harness.Database)
	events := client.OutboxEvent.Query().Where(outboxevent.EventType(eventType)).AllX(context.Background())
	subjects := map[string]int{}
	for _, event := range events {
		subjects[event.Subject]++
	}
	return subjects
}

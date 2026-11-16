package subscriptions_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/repositories"
)

func TestWebSubscriptionCheckoutIgnoresTheClientRegionHeaderAndNeedsARealCountry(t *testing.T) {
	owner, profileId := uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles:  map[string]repositories.BillingProfile{profileId: {ProfileId: profileId, OwnerUserId: owner, ProfileType: "business", DisplayName: "No Country Fabrics"}},
		Accounts:  map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-60 * 24 * time.Hour), EmailVerified: true}},
		Countries: map[string]string{},
	}
	harness := startSubscriptionsHarness(t, identity)
	token := harness.Tokens.UserAccessToken(owner)
	body := map[string]any{"profileId": profileId, "planId": "seller_pro_monthly"}
	spoofed := harness.Call(http.MethodPost, "/api/v1/seller/subscription/checkout", token, "", body, http.Header{"X-Client-Platform": {"web"}, "X-Client-Region": {"NG"}})
	if spoofed.Status != http.StatusUnprocessableEntity || spoofed.Body["code"] != "COUNTRY_REQUIRED" {
		t.Fatalf("a client region header must not set the charging country: %d %s", spoofed.Status, spoofed.Raw)
	}
	identity.Countries[owner] = "NG"
	started := harness.Call(http.MethodPost, "/api/v1/seller/subscription/checkout", token, "", body, http.Header{"X-Client-Platform": {"web"}, "X-Client-Region": {"US"}})
	if started.Status != http.StatusCreated || started.Body["price"].(map[string]any)["currency"] != "NGN" {
		t.Fatalf("the account country decides the price, not the header: %d %s", started.Status, started.Raw)
	}
}

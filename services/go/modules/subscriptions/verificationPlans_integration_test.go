package subscriptions

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/repositories"
)

func TestVerificationPlansFollowTheActingProfileAndCancelKeepsAccessToPeriodEnd(t *testing.T) {
	owner, personal, business := uuid.NewString(), uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			personal: {ProfileId: personal, OwnerUserId: owner, ProfileType: "personal", DisplayName: "Ada", CountryCode: "NG"},
			business: {ProfileId: business, OwnerUserId: owner, ProfileType: "business", DisplayName: "Ada Fabrics", CountryCode: "NG"},
		},
		Accounts:   map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-90 * 24 * time.Hour), EmailVerified: true, Email: "ada@example.com"}},
		Acting:     map[string]string{},
		Checkmarks: map[string]repositories.ProfileCheckmark{personal: {Color: "blue", Status: "verified"}},
	}
	harness := startSubscriptionsHarness(t, identity)
	token := harness.Tokens.UserAccessToken(owner)
	plans := harness.Call(http.MethodGet, "/api/v1/verification/plans", token, "", nil)
	if plans.Status != http.StatusOK || plans.Body["nextCursor"] != nil {
		t.Fatalf("plans: %d %s", plans.Status, plans.Raw)
	}
	seen := map[string]bool{}
	for _, item := range plans.Body["data"].([]any) {
		plan := item.(map[string]any)
		if plan["color"] != "blue" || plan["price"].(map[string]any)["currency"] != "NGN" || len(plan["perks"].([]any)) == 0 {
			t.Fatalf("personal plans are blue, regional and carry perks: %v", plan)
		}
		seen[plan["planCode"].(string)] = true
	}
	if !seen["blue_essential"] || !seen["blue"] || !seen["premium"] || seen["gold_only"] || seen["black"] {
		t.Fatalf("personal plan set: %v", seen)
	}
	if none := harness.Call(http.MethodPost, "/api/v1/verification/subscription/cancel", token, "cancel-none-1", nil); none.Status != http.StatusConflict {
		t.Fatalf("nothing to cancel: %d %s", none.Status, none.Raw)
	}
	checkout := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", token, "", map[string]any{"profileId": personal, "planId": "blue_monthly"})
	if checkout.Status != http.StatusCreated {
		t.Fatalf("checkout: %d %s", checkout.Status, checkout.Raw)
	}
	harness.PayCheckout(checkout.Body["reference"].(string), 0, "card")
	if missingKey := harness.Call(http.MethodPost, "/api/v1/verification/subscription/cancel", token, "", nil); missingKey.Status != http.StatusBadRequest {
		t.Fatalf("an Idempotency-Key is required: %d", missingKey.Status)
	}
	cancelled := harness.Call(http.MethodPost, "/api/v1/verification/subscription/cancel", token, "cancel-blue-1", nil)
	subscription, _ := cancelled.Body["subscription"].(map[string]any)
	current, _ := cancelled.Body["current"].(map[string]any)
	if cancelled.Status != http.StatusOK || subscription["cancelAtPeriodEnd"] != true || subscription["status"] != "active" || subscription["planId"] != "blue_monthly" || subscription["renewsAt"] != nil {
		t.Fatalf("cancel keeps access to the period end: %d %s", cancelled.Status, cancelled.Raw)
	}
	if current["color"] != "blue" || current["tier"] != "VERIFIED" || current["badgeVisible"] != true {
		t.Fatalf("current checkmark: %v", current)
	}
	if again := harness.Call(http.MethodPost, "/api/v1/verification/subscription/cancel", token, "cancel-blue-2", nil); again.Status != http.StatusOK {
		t.Fatalf("cancelling twice is harmless: %d %s", again.Status, again.Raw)
	}
	identity.Acting[owner] = business
	gold := harness.Call(http.MethodGet, "/api/v1/verification/plans", token, "", nil)
	codes := map[string]bool{}
	for _, item := range gold.Body["data"].([]any) {
		plan := item.(map[string]any)
		if plan["color"] != "gold" {
			t.Fatalf("business plans are gold: %v", plan)
		}
		codes[plan["planCode"].(string)] = true
	}
	if !codes["gold_only"] || !codes["seller_pro"] || !codes["seller_business"] || codes["black"] || codes["blue"] {
		t.Fatalf("business plan set: %v", codes)
	}
	offer := harness.Call(http.MethodGet, "/api/v1/subscriptions/offer?profileId="+business, token, "", nil)
	if offer.Status != http.StatusOK || offer.Body["accountEmail"] != "ada@example.com" || offer.Body["goldOnlyPlan"].(map[string]any)["isActive"] != false {
		t.Fatalf("offer carries the receipt email and gold-only state: %s", offer.Raw)
	}
}

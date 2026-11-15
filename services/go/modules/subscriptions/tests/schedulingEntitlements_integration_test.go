package subscriptions_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/repositories"
)

func TestScheduledPostEntitlementIsPaidAndBoundToTheSubscribedProfile(t *testing.T) {
	owner, personal, business, unrelated := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{Profiles: map[string]repositories.BillingProfile{
		personal:  {ProfileId: personal, OwnerUserId: owner, ProfileType: "personal", CountryCode: "NG"},
		business:  {ProfileId: business, OwnerUserId: owner, ProfileType: "business", CountryCode: "NG"},
		unrelated: {ProfileId: unrelated, OwnerUserId: owner, ProfileType: "brand", CountryCode: "NG"},
	}}
	harness := startSubscriptionsHarness(t, identity)
	ctx := context.Background()
	access := func(profileId string) bool {
		t.Helper()
		allowed, err := harness.module.Billing.CanSchedulePostsForProfile(ctx, owner, profileId)
		if err != nil {
			t.Fatal(err)
		}
		return allowed
	}
	if access(personal) || access(business) || access(unrelated) || access("") {
		t.Fatal("free profiles must not receive paid scheduling access")
	}

	token := harness.Tokens.UserAccessToken(owner)
	for _, purchase := range []struct{ profileId, planId string }{
		{personal, "blue_monthly"}, {business, "seller_pro_monthly"},
	} {
		checkout := harness.Call(http.MethodPost, "/api/v1/subscriptions/checkout", token, "", map[string]any{"profileId": purchase.profileId, "planId": purchase.planId})
		if checkout.Status != http.StatusCreated {
			t.Fatalf("checkout for %s: %d %s", purchase.profileId, checkout.Status, checkout.Raw)
		}
		harness.PayCheckout(checkout.Body["reference"].(string), 0, "card")
	}
	if !access(personal) || !access("") || !access(business) || access(unrelated) {
		t.Fatal("paid Blue and Gold entitlements must apply only to their own profiles (empty profile resolves to personal)")
	}
	internal := http.Header{"X-Internal-Token": {strings.Repeat("s", 32)}}
	profileEntitlement := harness.Call(http.MethodGet, "/api/v1/internal/entitlements/"+owner+"?includeScheduling=true&profileId="+business, "", "", nil, internal)
	if profileEntitlement.Status != http.StatusOK || profileEntitlement.Body["canSchedulePosts"] != true {
		t.Fatalf("profile-scoped scheduling entitlement endpoint: %d %s", profileEntitlement.Status, profileEntitlement.Raw)
	}
	unrelatedEntitlement := harness.Call(http.MethodGet, "/api/v1/internal/entitlements/"+owner+"?includeScheduling=true&profileId="+unrelated, "", "", nil, internal)
	if unrelatedEntitlement.Status != http.StatusOK || unrelatedEntitlement.Body["canSchedulePosts"] != false {
		t.Fatalf("unrelated profile must not inherit subscription entitlement: %d %s", unrelatedEntitlement.Status, unrelatedEntitlement.Raw)
	}

	client := harness.module.Billing.Container.Client(harness.Database)
	blue, err := client.Subscription.Query().Where(subscription.ProfileID(personal)).Only(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := blue.Update().SetStatus(subscription.StatusTrialing).SetTrialEndsAt(time.Now().Add(time.Hour)).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if access(personal) {
		t.Fatal("trial-only subscription must not satisfy paid scheduling entitlement")
	}
}

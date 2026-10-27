package subscriptions

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/repositories"
)

func TestOneTrialPerEmailAcrossAccounts(t *testing.T) {
	first, second, firstProfile, secondProfile := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	aged := time.Now().Add(-60 * 24 * time.Hour)
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{
			firstProfile:  {ProfileId: firstProfile, OwnerUserId: first, ProfileType: "business", DisplayName: "Ada Fabrics", CountryCode: "NG"},
			secondProfile: {ProfileId: secondProfile, OwnerUserId: second, ProfileType: "business", DisplayName: "Ada Fabrics Again", CountryCode: "NG"},
		},
		Accounts: map[string]repositories.AccountSignals{
			first:  {CreatedAt: aged, EmailVerified: true, Email: "ada@nantty.test"},
			second: {CreatedAt: aged, EmailVerified: true, Email: " Ada@Nantty.test "},
		},
	}
	harness := startSubscriptionsHarness(t, identity)
	web := http.Header{"X-Client-Platform": {"web"}}
	started := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", harness.Tokens.UserAccessToken(first), "", map[string]any{"profileId": firstProfile, "planId": "seller_pro_monthly"}, web)
	if started.Status != http.StatusCreated {
		t.Fatalf("first trial: %d %s", started.Status, started.Raw)
	}
	again := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", harness.Tokens.UserAccessToken(second), "", map[string]any{"profileId": secondProfile, "planId": "seller_pro_monthly"}, web)
	if again.Status != http.StatusConflict || again.Body["code"] != "TRIAL_NOT_AVAILABLE" {
		t.Fatalf("a second account with the same email must not get another trial: %d %s", again.Status, again.Raw)
	}
}

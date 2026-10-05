package subscriptions

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/repositories"
)

func TestRenewalWithALostPaystackReplyChargesTheCardOnce(t *testing.T) {
	owner, profileId := uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{profileId: {ProfileId: profileId, OwnerUserId: owner, ProfileType: "business", DisplayName: "Ada Fabrics", CountryCode: "NG"}},
		Accounts: map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-60 * 24 * time.Hour), EmailVerified: true}},
	}
	harness := startSubscriptionsHarness(t, identity)
	ctx := context.Background()
	token := harness.Tokens.UserAccessToken(owner)
	started := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", token, "", map[string]any{"profileId": profileId, "planId": "seller_pro_monthly"},
		http.Header{"X-Client-Platform": {"web"}, "X-Device-Id": {"device-lost-reply"}})
	if started.Status != http.StatusCreated {
		t.Fatalf("trial checkout: %d %s", started.Status, started.Raw)
	}
	harness.PayCheckout(started.Body["reference"].(string), 75, "card")
	client := harness.module.Billing.Container.Client(harness.Database)
	row, err := client.Subscription.Query().Where(subscription.ProfileID(profileId)).Only(ctx)
	if err != nil || row.NextChargeAt == nil {
		t.Fatalf("trial: %+v %v", row, err)
	}
	harness.Paystack.LoseNextChargeReply = true
	harness.clock = row.NextChargeAt.Add(time.Minute)
	harness.module.Billing.RunDueJobs(ctx)
	harness.clock = harness.clock.Add(2 * time.Hour)
	harness.module.Billing.RunDueJobs(ctx)
	row = client.Subscription.GetX(ctx, row.ID)
	renewals := 0
	for reference := range harness.Paystack.Transactions {
		if strings.HasPrefix(reference, "ren-") {
			renewals++
		}
	}
	if renewals != 1 || row.Status != subscription.StatusActive {
		t.Fatalf("one renewal charge despite the lost reply: charges=%d status=%s calls=%v", renewals, row.Status, harness.Paystack.CallCounts)
	}
	if authorization, err := harness.Payments.Application.Gateway.DescribeBillingAuthorization(ctx, row.BillingAuthorizationID); err != nil || !authorization.Usable {
		t.Fatalf("a lost reply must not revoke the saved card: %+v %v", authorization, err)
	}
}

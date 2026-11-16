package subscriptions_test

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/subscriptions/src/generated/ent/subscription"
	billingservices "nantty/modules/subscriptions/src/modules/billing/services"
	"nantty/modules/subscriptions/src/repositories"
)

func TestRenewalWithALostProviderReplyChargesTheCardOnce(t *testing.T) {
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
	harness.Flutterwave.LoseNextChargeReply = true
	harness.clock = row.NextChargeAt.Add(time.Minute)
	harness.module.Billing.RunDueJobs(ctx)
	harness.clock = harness.clock.Add(2 * time.Hour)
	harness.module.Billing.RunDueJobs(ctx)
	row = client.Subscription.GetX(ctx, row.ID)
	renewals := 0
	for _, transaction := range harness.Flutterwave.Transactions {
		if strings.HasPrefix(transaction.TxRef, "ren-") {
			renewals++
		}
	}
	if renewals != 1 || row.Status != subscription.StatusActive {
		t.Fatalf("one renewal charge despite the lost reply: charges=%d status=%s calls=%v", renewals, row.Status, harness.Flutterwave.CallCounts)
	}
	if authorization, err := harness.Payments.Application.Gateway.DescribeBillingAuthorization(ctx, row.BillingAuthorizationID); err != nil || !authorization.Usable {
		t.Fatalf("a lost reply must not revoke the saved card: %+v %v", authorization, err)
	}
}

func TestConcurrentRenewalWorkersClaimTheAttemptAtMostOnce(t *testing.T) {
	owner, profileId := uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{profileId: {ProfileId: profileId, OwnerUserId: owner, ProfileType: "business", DisplayName: "Concurrent Fabrics", CountryCode: "NG"}},
		Accounts: map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-60 * 24 * time.Hour), EmailVerified: true}},
	}
	harness := startSubscriptionsHarness(t, identity)
	ctx := context.Background()
	token := harness.Tokens.UserAccessToken(owner)
	started := harness.Call(http.MethodPost, "/api/v1/seller/subscription/trial/checkout", token, "", map[string]any{"profileId": profileId, "planId": "seller_pro_monthly"},
		http.Header{"X-Client-Platform": {"web"}, "X-Device-Id": {"device-concurrent-renewal"}})
	if started.Status != http.StatusCreated {
		t.Fatalf("trial checkout: %d %s", started.Status, started.Raw)
	}
	harness.PayCheckout(started.Body["reference"].(string), 75, "card")
	client := harness.module.Billing.Container.Client(harness.Database)
	row, err := client.Subscription.Query().Where(subscription.ProfileID(profileId)).Only(ctx)
	if err != nil || row.NextChargeAt == nil {
		t.Fatalf("trial: %+v %v", row, err)
	}
	harness.clock = row.NextChargeAt.Add(time.Minute)

	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- harness.module.Billing.ProcessDueSubscription(ctx, row.ID.String())
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil && !errors.Is(err, billingservices.ErrRenewalClaimConflict) {
			t.Fatalf("unexpected concurrent renewal error: %v", err)
		}
	}
	renewals := 0
	for _, transaction := range harness.Flutterwave.Transactions {
		if strings.HasPrefix(transaction.TxRef, "ren-") {
			renewals++
		}
	}
	if renewals != 1 {
		t.Fatalf("expected exactly 1 renewal charge across concurrent workers, got %d", renewals)
	}
}

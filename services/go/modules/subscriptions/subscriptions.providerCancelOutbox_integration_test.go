package subscriptions

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/subscriptions/src/generated/ent/outboxevent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/repositories"
)

func TestCancellingAProviderBilledPlanCommitsLocallyFirstAndCancelsAtTheProviderThroughTheOutbox(t *testing.T) {
	owner, profileId := uuid.NewString(), uuid.NewString()
	identity := repositories.StaticIdentityDirectory{
		Profiles: map[string]repositories.BillingProfile{profileId: {ProfileId: profileId, OwnerUserId: owner, ProfileType: "business", DisplayName: "Ada Fabrics", CountryCode: "NG"}},
		Accounts: map[string]repositories.AccountSignals{owner: {CreatedAt: time.Now().Add(-60 * 24 * time.Hour), EmailVerified: true}},
	}
	harness := startSubscriptionsHarness(t, identity)
	ctx := context.Background()
	client := harness.module.Billing.Container.Client(harness.Database)
	periodEnd := harness.clock.Add(20 * 24 * time.Hour)
	row, err := client.Subscription.Create().SetProfileID(profileId).SetProfileType("business").SetOwnerUserID(owner).SetPlanCode("seller_pro").SetInterval(subscription.IntervalMonth).
		SetChannel(subscription.ChannelWebCheckout).SetStatus(subscription.StatusActive).SetListAmountMinor(500_000).SetAmountMinor(500_000).SetCurrency("NGN").
		SetCurrentPeriodEndsAt(periodEnd).SetProviderPlanCode("PLN_unknown").SetBillingReference("sub-missing-at-provider").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	cancelled := harness.Call(http.MethodPost, "/api/v1/subscriptions/"+row.ID.String()+"/cancel", harness.Tokens.UserAccessToken(owner), "", nil)
	if cancelled.Status != http.StatusOK || cancelled.Body["cancelAtPeriodEnd"] != true {
		t.Fatalf("the local cancel must not wait on the provider: %d %s", cancelled.Status, cancelled.Raw)
	}
	queued, err := client.OutboxEvent.Query().Where(outboxevent.EventType("subscription.providerCancelRequested"), outboxevent.Subject(row.ID.String())).Count(ctx)
	if err != nil || queued != 1 {
		t.Fatalf("the provider cancel is queued in the same transaction: %d %v", queued, err)
	}
	if err := harness.module.Billing.HandleProviderCancelRequested(ctx, row.ID.String()); err == nil {
		t.Fatal("a provider failure must surface so the outbox retries it")
	}
	if err := client.Subscription.UpdateOneID(row.ID).SetCancelAtPeriodEnd(false).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if err := harness.module.Billing.HandleProviderCancelRequested(ctx, row.ID.String()); err != nil {
		t.Fatalf("a plan resumed before the event ran is not cancelled at the provider: %v", err)
	}
}

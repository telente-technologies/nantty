package services

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/subscriptions/src/container"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/subscription"
	"nantty/modules/subscriptions/src/models"
	platformevents "nantty/platform/events"
)

func TestCheckmarkComponentPerPlan(t *testing.T) {
	want := map[string]string{
		"seller_pro": models.CheckmarkSplitFromPlan, "seller_business": models.CheckmarkSplitFromPlan, "premium": models.CheckmarkSplitFromPlan,
		"blue": models.CheckmarkIsWholePlan, "gold_only": models.CheckmarkIsWholePlan, "black": models.CheckmarkIsWholePlan, "blue_essential": models.CheckmarkNotInPlan,
	}
	for plan, split := range want {
		if got := CheckmarkSplitOf(plan); got != split {
			t.Fatalf("%s: %s", plan, got)
		}
	}
}

func TestFirstPeriodChargeMatchesTheCheckoutQuote(t *testing.T) {
	cases := []struct {
		name  string
		plan  string
		quote models.PriceQuote
		mark  int64
	}{
		{"pro monthly", "seller_pro", models.PriceQuote{ListAmountMinor: 500_000, AmountMinor: 500_000, DiscountKind: "none"}, 300_000},
		{"gold with the bundle", "gold_only", models.PriceQuote{ListAmountMinor: 300_000, AmountMinor: 255_000, DiscountKind: "bundle", DiscountBps: 1500}, 300_000},
		{"pro yearly", "seller_pro", models.PriceQuote{ListAmountMinor: 6_000_000, AmountMinor: 4_800_000, DiscountKind: "yearly", DiscountBps: 2000}, 2_900_000},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			charge := FirstPeriodCharge(testCase.plan, testCase.quote, testCase.mark)
			if charge.AmountDueMinor != testCase.quote.AmountMinor || !charge.CheckmarkIncluded {
				t.Fatalf("charge %+v", charge)
			}
		})
	}
	if bookPeriodPrice(500_000, 0, "year", 2000) != 4_800_000 || bookPeriodPrice(500_000, 4_700_000, "year", 2000) != 4_700_000 || bookPeriodPrice(500_000, 4_700_000, "month", 2000) != 500_000 {
		t.Fatal("yearly price is 20% off unless the price book sets one")
	}
}

func TestOnlyCardSubscriptionsWithASavedAuthorizationRunOnTheEngine(t *testing.T) {
	cases := []struct {
		row  ent.Subscription
		want bool
	}{
		{ent.Subscription{Channel: subscription.ChannelWebCheckout, BillingAuthorizationID: "auth"}, true},
		{ent.Subscription{Channel: subscription.ChannelWebCheckout, BillingAuthorizationID: "auth", ProviderPlanCode: "PLN_legacy"}, false},
		{ent.Subscription{Channel: subscription.ChannelWebCheckout}, false},
		{ent.Subscription{Channel: subscription.ChannelAppleIap, BillingAuthorizationID: "auth"}, false},
	}
	for index, testCase := range cases {
		if IsEngineManaged(&testCase.row) != testCase.want {
			t.Fatalf("case %d", index)
		}
	}
}

func TestBillingJobMessagesRejectGarbageAsPoison(t *testing.T) {
	billing := Billing{Container: &container.Container{}}
	for _, body := range []string{"not json", `{"type":"other","payload":{}}`, `{"type":"subscriptionBilling.processDue","payload":{}}`} {
		if err := billing.HandleSubscriptionBillingJobMessage(context.Background(), []byte(body)); !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("%s: %v", body, err)
		}
	}
}

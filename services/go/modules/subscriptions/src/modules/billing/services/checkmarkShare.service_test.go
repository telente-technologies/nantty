package services

import (
	"testing"
	"time"

	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/platform/regionpricing"
)

func TestOnlyPlansSellingMoreThanTheCheckmarkKeepRunningOnRejection(t *testing.T) {
	for plan, want := range map[string]bool{
		"seller_pro": true, "seller_business": true, "premium": true,
		"blue": false, "gold_only": false, "black": false, "unknown": false,
	} {
		if got := KeepsPlanOnRejection(plan); got != want {
			t.Errorf("%s: got %v, want %v", plan, got, want)
		}
	}
	if CheckmarkOfPlan("premium") != "blue" || CheckmarkOfPlan("seller_pro") != "gold" {
		t.Fatal("share must use the checkmark each plan carries")
	}
}

func TestVerificationRefundBranchesForPlansThatKeepRunning(t *testing.T) {
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	future := now.Add(72 * time.Hour)
	paid := func(plan string, channel subscription.Channel) ent.Subscription {
		return ent.Subscription{PlanCode: plan, Channel: channel, BillingReference: "sub-1", AmountMinor: 500_000, Currency: "NGN", StoreOriginalTransactionID: "token"}
	}
	trial := paid("seller_pro", subscription.ChannelWebPaystack)
	trial.WithTrial, trial.TrialEndsAt = true, &future
	cases := []struct {
		name string
		row  ent.Subscription
		want VerificationRefundPath
	}{
		{"seller plan paid on web refunds the share to the card", paid("seller_pro", subscription.ChannelWebPaystack), RefundPathCardShare},
		{"premium paid on web refunds the share to the card", paid("premium", subscription.ChannelWebPaystack), RefundPathCardShare},
		{"Google Play tries a partial refund", paid("premium", subscription.ChannelGooglePlay), RefundPathGoogleShare},
		{"App Store is flagged for a manual refund", paid("premium", subscription.ChannelAppleIap), RefundPathAppleManual},
		{"running trial charged nothing so the plan just continues", trial, RefundPathNothingCharged},
		{"standalone Gold still gets the full refund", paid("gold_only", subscription.ChannelWebPaystack), RefundPathCard},
		{"standalone Blue on Google still gets the full revoke", paid("blue", subscription.ChannelGooglePlay), RefundPathGooglePlay},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := DecideVerificationRefundPath(&testCase.row, now); got != testCase.want {
				t.Fatalf("got %s, want %s", got, testCase.want)
			}
		})
	}
}

func TestZeroShareMakesNoRefundCall(t *testing.T) {
	for _, path := range []VerificationRefundPath{RefundPathCardShare, RefundPathGoogleShare, RefundPathAppleManual} {
		if got := ApplyShareToPath(path, 0); got != RefundPathNothingCharged {
			t.Errorf("%s with no share became %s", path, got)
		}
		if got := ApplyShareToPath(path, 300_000); got != path {
			t.Errorf("%s with a share changed to %s", path, got)
		}
	}
	if got := ApplyShareToPath(RefundPathCard, 0); got != RefundPathCard {
		t.Fatalf("full refunds are untouched, got %s", got)
	}
}

func TestBundleTierThatFailsRefundsOnlyItsOwnCappedShare(t *testing.T) {
	gold := regionpricing.DefaultCheckmarkStandalonePrice("gold", "NGN", "web", "month")
	blue := regionpricing.DefaultCheckmarkStandalonePrice("blue", "NGN", "web", "month")
	discountedSellerPro := int64(500_000 * 85 / 100)
	if got := regionpricing.CheckmarkShareMinor(gold, discountedSellerPro); got != 300_000 {
		t.Fatalf("Gold share of a Pro plan = %d", got)
	}
	if got := regionpricing.CheckmarkShareMinor(gold, 255_000); got != 255_000 {
		t.Fatalf("a discounted Gold-only bundle tier is capped at what it paid, got %d", got)
	}
	if got := regionpricing.CheckmarkShareMinor(blue, 450_000); got != 250_000 {
		t.Fatalf("Blue share of Premium = %d", got)
	}
}

package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"zudomart/modules/subscriptions/src/container"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/subscription"
	"zudomart/modules/subscriptions/src/repositories"
)

func TestRejectedVerificationRefundPathPerChannel(t *testing.T) {
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	future, past := now.Add(72*time.Hour), now.Add(-time.Hour)
	cases := []struct {
		name string
		row  ent.Subscription
		want VerificationRefundPath
	}{
		{"paid web plan gets a Paystack refund", ent.Subscription{Channel: subscription.ChannelWebCheckout, BillingReference: "sub-1", AmountMinor: 250_000}, RefundPathCard},
		{"converted web trial was charged", ent.Subscription{Channel: subscription.ChannelWebCheckout, BillingReference: "sub-1", AmountMinor: 250_000, WithTrial: true, TrialEndsAt: &past}, RefundPathCard},
		{"running web trial was never charged", ent.Subscription{Channel: subscription.ChannelWebCheckout, BillingReference: "sub-1", AmountMinor: 250_000, WithTrial: true, TrialEndsAt: &future}, RefundPathNothingCharged},
		{"Google Play is revoked with a full refund", ent.Subscription{Channel: subscription.ChannelGooglePlay, StoreOriginalTransactionID: "token"}, RefundPathGooglePlay},
		{"App Store needs a manual refund request", ent.Subscription{Channel: subscription.ChannelAppleIap, StoreOriginalTransactionID: "1000"}, RefundPathAppleManual},
		{"admin grant has nothing to refund", ent.Subscription{Channel: subscription.ChannelAdminGrant}, RefundPathNothingCharged},
		{"a finished refund is never repeated", ent.Subscription{Channel: subscription.ChannelWebCheckout, BillingReference: "sub-1", AmountMinor: 250_000, LastError: verificationRefundDone}, RefundPathAlreadyDone},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := DecideVerificationRefundPath(&testCase.row, now); got != testCase.want {
				t.Fatalf("got %s, want %s", got, testCase.want)
			}
		})
	}
}

type eligibilityDirectory struct {
	repositories.StaticIdentityDirectory
	allowed map[string]bool
	err     error
}

func (directory eligibilityDirectory) CheckmarkPurchaseAllowed(_ context.Context, profileId string) (bool, error) {
	return directory.allowed[profileId], directory.err
}

func TestCheckmarkCheckoutIsGatedOnEligibility(t *testing.T) {
	billing := Billing{Container: &container.Container{Identity: eligibilityDirectory{allowed: map[string]bool{"eligible": true}}}}
	ctx := context.Background()
	if err := billing.RequireCheckmarkPurchaseAllowed(ctx, "blue", "eligible"); err != nil {
		t.Fatalf("an eligible profile can buy now: %v", err)
	}
	if err := billing.RequireCheckmarkPurchaseAllowed(ctx, "gold_only", "queued"); !errors.Is(err, ErrVerificationNotEligible) {
		t.Fatalf("a queued request cannot pay yet: %v", err)
	}
	if err := billing.RequireCheckmarkPurchaseAllowed(ctx, "seller_pro", "queued"); err != nil {
		t.Fatalf("seller plans are not gated on checkmark trust: %v", err)
	}
}

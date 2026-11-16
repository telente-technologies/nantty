package services_test

import (
	"errors"
	"testing"
	"time"

	"nantty/modules/wallet/src/modules/payouts/services"
)

func TestTheCooldownMessageUsesTheConfiguredDuration(t *testing.T) {
	cases := map[time.Duration]string{
		48 * time.Hour: "48 hours", time.Hour: "1 hour", 72 * time.Hour: "72 hours", 30 * time.Minute: "30 minutes",
		time.Minute: "1 minute", 90 * time.Minute: "90 minutes", 25*time.Hour + 30*time.Second: "26 hours", 10 * time.Second: "1 minute",
	}
	for cooldown, want := range cases {
		if got := services.DescribeCooldown(cooldown); got != want {
			t.Errorf("DescribeCooldown(%s) = %q, want %q", cooldown, got, want)
		}
	}
	from := time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC)
	failure := services.PayoutAccountCoolingDown(24*time.Hour, from)
	if failure.Message != "New payout accounts can receive withdrawals 24 hours after they are added." || failure.Details["withdrawableFrom"] != "2026-10-14T09:00:00Z" {
		t.Fatalf("unexpected error: %+v", failure)
	}
	if !errors.Is(failure, services.ErrPayoutAccountCoolingDown) || services.ErrPayoutAccountCoolingDown.Details != nil {
		t.Fatal("the code must stay PAYOUT_ACCOUNT_COOLING_DOWN and the shared error must not be mutated")
	}
}

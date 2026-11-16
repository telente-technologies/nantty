package services_test

import (
	"testing"
	"time"

	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/services"
)

func TestCreditBalanceConsumesOldestExpiryFirst(t *testing.T) {
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	soon, later := now.Add(10*24*time.Hour), now.Add(60*24*time.Hour)
	entries := []services.CreditEntry{
		{Kind: enums.CreditEarn, AmountMinor: 10_000, ExpiresAt: &later, CreatedAt: now.Add(-48 * time.Hour)},
		{Kind: enums.CreditEarn, AmountMinor: 5_000, ExpiresAt: &soon, CreatedAt: now.Add(-24 * time.Hour)},
		{Kind: enums.CreditRedeem, AmountMinor: 6_000, CreatedAt: now.Add(-time.Hour)},
	}
	state := services.ComputeCreditState(entries, now)
	if state.BalanceMinor != 9_000 {
		t.Fatalf("balance = %d, want 9000", state.BalanceMinor)
	}
	if state.NextExpiryAt == nil || !state.NextExpiryAt.Equal(later) {
		t.Fatalf("the sooner grant was used up first, so the next expiry is the later grant, got %v", state.NextExpiryAt)
	}
}

func TestExpiredCreditIsReportedOnceThenRecorded(t *testing.T) {
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	expired := now.Add(-time.Hour)
	entries := []services.CreditEntry{{Kind: enums.CreditEarn, AmountMinor: 7_000, ExpiresAt: &expired, CreatedAt: now.Add(-48 * time.Hour)}, {Kind: enums.CreditRedeem, AmountMinor: 2_000, CreatedAt: now.Add(-72 * time.Hour)}}
	state := services.ComputeCreditState(entries, now)
	if state.BalanceMinor != 0 || state.UnrecordedExpiryMinor != 5_000 {
		t.Fatalf("state = %+v", state)
	}
	entries = append(entries, services.CreditEntry{Kind: enums.CreditExpire, AmountMinor: 5_000, CreatedAt: now})
	if after := services.ComputeCreditState(entries, now); after.UnrecordedExpiryMinor != 0 || after.BalanceMinor != 0 {
		t.Fatalf("after recording the expiry: %+v", after)
	}
}

func TestEarnedCreditRulesAndCaps(t *testing.T) {
	rules := services.RewardRules{Enabled: true, BasisPoints: 500, MinimumOrderMinor: 1_000_000, MaximumMinor: 100_000}
	cases := []struct {
		subtotal int64
		want     int64
	}{{999_999, 0}, {1_000_000, 50_000}, {5_000_000, 100_000}}
	for _, testCase := range cases {
		if got := services.CalculateEarnedCreditMinor(rules, testCase.subtotal); got != testCase.want {
			t.Errorf("subtotal %d earned %d, want %d", testCase.subtotal, got, testCase.want)
		}
	}
	if services.CalculateEarnedCreditMinor(services.RewardRules{BasisPoints: 500}, 1_000_000) != 0 {
		t.Fatal("disabled rewards earn nothing")
	}
}

func TestRedeemableCreditNeverMakesTheOrderFree(t *testing.T) {
	if services.RedeemableCreditMinor(10_000, 4_000) != 3_999 || services.RedeemableCreditMinor(500, 4_000) != 500 || services.RedeemableCreditMinor(500, 1) != 0 {
		t.Fatal("redeemable credit maths wrong")
	}
}

func TestReversalFollowsRefundsAndNeverExceedsTheBalance(t *testing.T) {
	if got := services.ProportionalReversalMinor(1_000, 0, 5_000, 10_000, 1_000); got != 500 {
		t.Fatalf("half refund reverses half, got %d", got)
	}
	if got := services.ProportionalReversalMinor(1_000, 500, 10_000, 10_000, 300); got != 300 {
		t.Fatalf("reversal is capped at the unspent balance, got %d", got)
	}
	if got := services.ProportionalReversalMinor(1_000, 1_000, 10_000, 10_000, 1_000); got != 0 {
		t.Fatalf("already fully reversed, got %d", got)
	}
}

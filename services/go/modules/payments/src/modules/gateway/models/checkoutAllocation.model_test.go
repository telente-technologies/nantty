package models

import "testing"

func TestPaystackLocalFeeEstimate(t *testing.T) {
	cases := map[int64]int64{100_000: 1_500, 249_999: 3_750, 250_000: 13_750, 10_000_000: 160_000, 50_000_000: 200_000}
	for amount, want := range cases {
		if got := EstimatePaystackLocalFee(amount); got != want {
			t.Fatalf("fee for %d: got %d want %d", amount, got, want)
		}
	}
}

func TestCheckoutAllocationKeepsEveryKoboAndSplitsOnlyDirectGroups(t *testing.T) {
	groups, err := AllocateCheckoutGroups([]CheckoutGroupAllocation{
		{OrderId: "o-escrow", PaymentMode: "escrow", SellerUserId: "s1", AmountMinor: 1_000_000, EscrowFeeMinor: 15_000},
		{OrderId: "o-direct", PaymentMode: "direct", SellerUserId: "s2", Subaccount: "ACCT_s2", AmountMinor: 2_000_000},
		{OrderId: "o-business", PaymentMode: "escrow", SellerUserId: "s3", AmountMinor: 333_333, EscrowFeeMinor: 3_333},
	})
	if err != nil {
		t.Fatal(err)
	}
	var feeTotal int64
	for _, group := range groups {
		feeTotal += group.EstimatedFeeMinor
	}
	if feeTotal != EstimatePaystackLocalFee(3_333_333) {
		t.Fatalf("allocated fees %d", feeTotal)
	}
	direct := groups[1]
	if direct.ShareMinor != direct.AmountMinor-direct.EstimatedFeeMinor || direct.EscrowFeeMinor != 0 || groups[0].ShareMinor != 0 {
		t.Fatalf("groups %+v", groups)
	}
	settled := SettleCheckoutGroups(groups, 52_000)
	var applied, fees int64
	for _, group := range settled {
		applied += group.AppliedAmountMinor
		fees += group.ProviderFeeMinor
	}
	if settled[1].ProviderFeeMinor != direct.EstimatedFeeMinor || settled[1].AppliedAmountMinor != direct.ShareMinor {
		t.Fatalf("direct settlement %+v", settled[1])
	}
	if fees != 52_000 || applied+direct.EstimatedFeeMinor != 3_333_333 {
		t.Fatalf("fees %d applied %d", fees, applied)
	}
	if _, err := AllocateCheckoutGroups([]CheckoutGroupAllocation{{OrderId: "x", PaymentMode: "direct", AmountMinor: 100}}); err == nil {
		t.Fatal("a direct group without a subaccount must be refused")
	}
}

func TestProRataAllocationGivesRemaindersToTheFirstGroups(t *testing.T) {
	parts := AllocateProRata(100, []int64{1, 1, 1})
	if parts[0]+parts[1]+parts[2] != 100 || parts[0] != 34 {
		t.Fatalf("parts %v", parts)
	}
	if parts := AllocateProRata(10, []int64{0, 5, 0}); parts[1] != 10 || parts[0] != 0 {
		t.Fatalf("parts %v", parts)
	}
}

func TestProRataAllocationGivesTheRemainderToTheLargestFractionsAndNeverOverflows(t *testing.T) {
	if parts := AllocateProRata(10, []int64{1, 1, 8}); parts[0] != 1 || parts[1] != 1 || parts[2] != 8 {
		t.Fatalf("exact split: %v", parts)
	}
	if parts := AllocateProRata(100, []int64{10, 10, 79}); parts[0]+parts[1]+parts[2] != 100 || parts[2] != 80 {
		t.Fatalf("the leftover unit goes to the largest fraction, not index 0: %v", parts)
	}
	huge := int64(1) << 62
	parts := AllocateProRata(huge, []int64{huge, huge, huge})
	if parts[0]+parts[1]+parts[2] != huge || parts[0] < 0 || parts[2] < 0 {
		t.Fatalf("large totals and weights must not overflow: %v", parts)
	}
}

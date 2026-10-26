package services

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	verificationevents "nantty/modules/users/src/modules/identityVerification/events"
)

func TestRefundScopeFollowsWhatThePlanSells(t *testing.T) {
	for plan, want := range map[string]string{
		"blue": RefundScopeFull, "gold_only": RefundScopeFull,
		"seller_pro": RefundScopeCheckmarkShare, "seller_business": RefundScopeCheckmarkShare, "premium": RefundScopeCheckmarkShare, "gold_combined": RefundScopeCheckmarkShare,
	} {
		if got := RefundScopeFor(plan); got != want {
			t.Errorf("%s: got %s, want %s", plan, got, want)
		}
		if !refundsOnRejection(plan) {
			t.Errorf("%s must be refunded on rejection", plan)
		}
	}
	if refundsOnRejection("seller_free") {
		t.Fatal("an unknown plan is never refunded")
	}
}

func TestShareRefundNoticeCarriesTheAmountOnlyWhenSomethingWasRefunded(t *testing.T) {
	profile := &ent.Profile{AccountID: uuid.New(), Handle: "adire"}
	row := &ent.VerificationCase{ID: uuid.New(), Color: "gold", DecisionReason: "Name mismatch"}
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	amount := &verificationevents.Money{AmountMinor: 300_000, Currency: "NGN"}
	cases := []struct {
		event      string
		wantMethod string
		wantAmount bool
	}{
		{"verificationRefund.succeeded", "plan_share_card", true},
		{"verificationRefund.manualStoreRefundRequired", "plan_share_store", true},
		{"verificationRefund.failed", "plan_share_store", true},
		{"verificationRefund.notCharged", "plan_continues", false},
	}
	for _, testCase := range cases {
		notice := ShareRefundNotice(profile, row, testCase.event, amount, now)
		if notice.RefundMethod != testCase.wantMethod || (notice.RefundAmount != nil) != testCase.wantAmount {
			t.Errorf("%s: got %s amount=%v", testCase.event, notice.RefundMethod, notice.RefundAmount)
		}
		if notice.Reasons[0] != "Name mismatch" || notice.ReapplyFrom != "2026-11-03T12:00:00Z" || notice.Checkmark != "gold" {
			t.Errorf("%s: notice lost its context: %+v", testCase.event, notice)
		}
	}
}

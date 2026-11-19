package services_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	verificationevents "nantty/modules/users/src/modules/identityVerification/events"
	"nantty/modules/users/src/modules/identityVerification/services"
)

func TestRefundScopeFollowsWhatThePlanSells(t *testing.T) {
	for plan, want := range map[string]string{
		"blue": services.RefundScopeFull, "gold_only": services.RefundScopeFull,
		"seller_pro": services.RefundScopeCheckmarkShare, "seller_business": services.RefundScopeCheckmarkShare, "premium": services.RefundScopeCheckmarkShare, "gold_combined": services.RefundScopeCheckmarkShare,
	} {
		if got := services.RefundScopeFor(plan); got != want {
			t.Errorf("%s: got %s, want %s", plan, got, want)
		}
		if !services.RefundsOnRejection(plan) {
			t.Errorf("%s must be refunded on rejection", plan)
		}
	}
	if services.RefundsOnRejection("seller_free") {
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
		notice := services.ShareRefundNotice(profile, row, testCase.event, amount, now)
		if notice.RefundMethod != testCase.wantMethod || (notice.RefundAmount != nil) != testCase.wantAmount {
			t.Errorf("%s: got %s amount=%v", testCase.event, notice.RefundMethod, notice.RefundAmount)
		}
		if notice.Reasons[0] != "Name mismatch" || notice.ReapplyFrom != "2026-11-03T12:00:00Z" || notice.Checkmark != "gold" {
			t.Errorf("%s: notice lost its context: %+v", testCase.event, notice)
		}
	}
}

func TestSmileProductsSeparatePhotoDocumentsFromIDNumbers(t *testing.T) {
	if product, ok := services.SmileProductFor(services.VerificationMethodDocument, "US", "PASSPORT"); !ok || product != "document_verification" {
		t.Fatalf("photo IDs must use standard document verification: %q, %t", product, ok)
	}
	if product, ok := services.SmileProductFor(services.VerificationMethodIdNumber, "NG", "NIN_V2"); !ok || product != "enhanced_kyc" {
		t.Fatalf("configured ID-number checks must use Enhanced KYC: %q, %t", product, ok)
	}
	if product, ok := services.SmileProductFor(services.VerificationMethodIdNumber, "CI", "NATIONAL_ID"); !ok || product != "enhanced_kyc" {
		t.Fatalf("country/type coverage must be driven by Smile's current catalog and the account allowlist: %q, %t", product, ok)
	}
	if !services.SmileIdTypeEnabled([]string{"NG:NIN_V2"}, "NG", "NIN_V2") || services.SmileIdTypeEnabled([]string{"NG:NIN_V2"}, "NG", "V_NIN") || services.SmileIdTypeEnabled(nil, "CI", "NATIONAL_ID") {
		t.Fatal("an ID option must require an exact partner-enabled country/type pair")
	}
	if !services.SmileProductEnabled([]string{"document_verification"}, "document_verification") || services.SmileProductEnabled(nil, "enhanced_kyc") {
		t.Fatal("product availability must require explicit partner-account configuration")
	}
}

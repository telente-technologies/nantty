package applyentitlement

import (
	"testing"

	"zudomart/modules/users/src/generated/ent/profilecheckmark"
	"zudomart/modules/users/src/generated/ent/profilesignal"
)

func TestEntitlementEventsMapToCheckmarkAndPlanState(t *testing.T) {
	cases := []struct {
		name          string
		command       Command
		profileColor  profilecheckmark.Color
		goldVerified  bool
		wantCheckmark bool
		wantStatus    profilecheckmark.Status
		wantSeller    profilesignal.SellerPlan
		wantPremium   *bool
	}{
		{"blue granted", Command{EventType: "entitlement.granted", Plan: "blue", Checkmark: "blue"}, profilecheckmark.ColorBlue, false, true, profilecheckmark.StatusVerified, "", nil},
		{"blue never on a business", Command{EventType: "entitlement.granted", Plan: "blue", Checkmark: "blue"}, profilecheckmark.ColorGold, true, false, "", "", nil},
		{"seller pro before KYB keeps the plan but no gold", Command{EventType: "entitlement.granted", Plan: "seller_pro", Checkmark: "gold", SellerPlan: "pro"}, profilecheckmark.ColorGold, false, false, "", profilesignal.SellerPlanPRO, nil},
		{"seller business after KYB", Command{EventType: "entitlement.granted", Plan: "seller_business", Checkmark: "gold", SellerPlan: "business"}, profilecheckmark.ColorGold, true, true, profilecheckmark.StatusVerified, profilesignal.SellerPlanBUSINESS, nil},
		{"seller plan revoked", Command{EventType: "entitlement.revoked", Plan: "seller_pro", Checkmark: "gold", SellerPlan: "pro"}, profilecheckmark.ColorGold, true, true, profilecheckmark.StatusExpired, profilesignal.SellerPlanFREE, nil},
		{"black grace", Command{EventType: "entitlement.graceStarted", Plan: "black", Checkmark: "black"}, profilecheckmark.ColorBlack, false, true, profilecheckmark.StatusGrace, "", nil},
		{"premium granted", Command{EventType: "entitlement.granted", Plan: "premium"}, profilecheckmark.ColorBlue, false, false, "", "", pointer(true)},
		{"premium revoked", Command{EventType: "entitlement.revoked", Plan: "premium"}, profilecheckmark.ColorBlue, false, false, "", "", pointer(false)},
	}
	for _, testCase := range cases {
		decision := DecideEntitlementChange(testCase.command, testCase.profileColor, testCase.goldVerified)
		if decision.ChangeCheckmark != testCase.wantCheckmark || (testCase.wantCheckmark && decision.CheckmarkStatus != testCase.wantStatus) {
			t.Fatalf("%s: checkmark %+v", testCase.name, decision)
		}
		if (testCase.wantSeller != "") != decision.ChangeSeller || (decision.ChangeSeller && decision.SellerPlan != testCase.wantSeller) {
			t.Fatalf("%s: seller %+v", testCase.name, decision)
		}
		if (testCase.wantPremium != nil) != decision.ChangePremium || (decision.ChangePremium && decision.Premium != *testCase.wantPremium) {
			t.Fatalf("%s: premium %+v", testCase.name, decision)
		}
	}
}

func pointer(value bool) *bool { return &value }

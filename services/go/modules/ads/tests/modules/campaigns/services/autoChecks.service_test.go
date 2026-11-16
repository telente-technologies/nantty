package services_test

import (
	"testing"

	campaignservices "nantty/modules/ads/src/modules/campaigns/services"
	"nantty/modules/ads/src/types"
)

func TestAutomatedPolicyChecksFlagProhibitedClaims(t *testing.T) {
	flags := campaignservices.RunAutomatedPolicyChecks(types.CreativeInput{Headline: "Double your money in 7 days", PrimaryText: "First copy bags"})
	if len(flags) != 2 || !campaignservices.HasCriticalFlag(flags) {
		t.Fatalf("expected a critical financial flag and a counterfeit flag, got %+v", flags)
	}
	if clean := campaignservices.RunAutomatedPolicyChecks(types.CreativeInput{Headline: "Fresh Ankara fabrics", PrimaryText: "Delivered in Lagos"}); len(clean) != 0 {
		t.Fatalf("ordinary copy should not be flagged: %+v", clean)
	}
}

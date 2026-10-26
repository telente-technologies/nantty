package services

import (
	"testing"

	"nantty/modules/ads/src/types"
)

func TestAutomatedPolicyChecksFlagProhibitedClaims(t *testing.T) {
	flags := RunAutomatedPolicyChecks(types.CreativeInput{Headline: "Double your money in 7 days", PrimaryText: "First copy bags"})
	if len(flags) != 2 || !HasCriticalFlag(flags) {
		t.Fatalf("expected a critical financial flag and a counterfeit flag, got %+v", flags)
	}
	if clean := RunAutomatedPolicyChecks(types.CreativeInput{Headline: "Fresh Ankara fabrics", PrimaryText: "Delivered in Lagos"}); len(clean) != 0 {
		t.Fatalf("ordinary copy should not be flagged: %+v", clean)
	}
}

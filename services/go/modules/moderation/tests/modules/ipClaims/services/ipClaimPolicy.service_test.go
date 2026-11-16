package services_test

import (
	"slices"
	"testing"

	"nantty/modules/moderation/src/modules/ipClaims/services"
)

func TestIpClaimStateMachine(t *testing.T) {
	for _, testCase := range []struct {
		from, action string
		want         bool
	}{
		{"open", "uphold", true}, {"open", "reject", true}, {"open", "request_info", true}, {"needs_info", "uphold", true}, {"needs_info", "reject", true},
		{"needs_info", "request_info", false}, {"upheld", "reject", false}, {"rejected", "uphold", false}, {"open", "bogus", false},
	} {
		if services.CanTransition(testCase.from, testCase.action) != testCase.want {
			t.Errorf("%s %s", testCase.from, testCase.action)
		}
	}
	if !slices.Equal(services.AllowedActions("open"), []string{"uphold", "reject", "request-info"}) || !slices.Equal(services.AllowedActions("needs_info"), []string{"uphold", "reject"}) || len(services.AllowedActions("upheld")) != 0 {
		t.Fatal("allowed actions follow the state machine")
	}
	if services.StrikePolicyForKind("counterfeit") != "Counterfeit goods" || services.StrikePolicyForKind("trademark") != "Trademark infringement" {
		t.Fatal("strike policy follows the claim kind")
	}
}

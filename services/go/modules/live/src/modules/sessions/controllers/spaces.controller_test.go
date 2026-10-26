package controllers

import (
	"testing"

	"github.com/google/uuid"
)

func TestSpaceHostAuthorization(t *testing.T) {
	host, other := uuid.New(), uuid.New()
	if !spaceHostAuthorized(host, host) {
		t.Fatal("host must be authorized")
	}
	if spaceHostAuthorized(host, other) {
		t.Fatal("non-host must be denied")
	}
}

func TestSpaceStateTransitions(t *testing.T) {
	allowed := [][2]string{{"scheduled", "live"}, {"scheduled", "cancelled"}, {"live", "ended"}, {"live", "cancelled"}}
	for _, transition := range allowed {
		if !spaceTransitionAllowed(transition[0], transition[1]) {
			t.Errorf("expected %s -> %s", transition[0], transition[1])
		}
	}
	for _, transition := range [][2]string{{"ended", "live"}, {"cancelled", "live"}, {"live", "cancelled"}, {"ended", "cancelled"}, {"scheduled", "ended"}} {
		if spaceTransitionAllowed(transition[0], transition[1]) {
			t.Errorf("unexpected %s -> %s", transition[0], transition[1])
		}
	}
}

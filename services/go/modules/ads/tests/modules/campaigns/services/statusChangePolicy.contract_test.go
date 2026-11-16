package services_test

import (
	"testing"

	"nantty/modules/ads/src/modules/campaigns/services"
)

func TestStatusChangesAllowOnlyPauseAndResumeOfLiveItems(t *testing.T) {
	if services.RequireStatusChangeAllowed("active", "paused") != nil || services.RequireStatusChangeAllowed("paused", "active") != nil {
		t.Fatal("active and paused swap freely")
	}
	for _, current := range []string{"draft", "in_review", "rejected", "completed"} {
		if services.RequireStatusChangeAllowed(current, "active") == nil {
			t.Errorf("%s -> active must be refused", current)
		}
	}
	if services.RequireStatusChangeAllowed("active", "completed") == nil {
		t.Fatal("clients cannot complete items")
	}
}

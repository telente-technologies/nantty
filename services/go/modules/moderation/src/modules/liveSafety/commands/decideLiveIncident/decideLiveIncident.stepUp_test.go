package decideliveincident

import (
	"context"
	"errors"
	"testing"

	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

func TestEveryStrikeBearingLiveDecisionRequiresStepUp(t *testing.T) {
	staff := staffauth.Staff{Id: "00000000-0000-0000-0000-000000000001", Permissions: []string{"moderation:reports"}}
	days := 7
	for _, action := range []string{ActionKeepPaused, ActionEndLive, ActionEndAndSuspend} {
		err := Handler{}.Execute(context.Background(), Command{Staff: staff, IncidentId: "x", Action: action, Reason: "unsafe broadcast", DurationDays: &days})
		var apiError *httpserver.ApiError
		if !errors.As(err, &apiError) || apiError.Code != "STEP_UP_REQUIRED" {
			t.Fatalf("%s without step-up must be refused, got %v", action, err)
		}
	}
}

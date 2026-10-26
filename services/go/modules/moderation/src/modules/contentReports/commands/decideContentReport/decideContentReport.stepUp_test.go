package decidecontentreport

import (
	"context"
	"errors"
	"testing"

	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

func TestStrikeBearingContentActionsRequireStepUp(t *testing.T) {
	staff := staffauth.Staff{Id: "00000000-0000-0000-0000-000000000001", Permissions: []string{"moderation:reports", "users:moderate", "users:suspend", "verification:revoke"}}
	for _, action := range []string{"REMOVE", "WARN_AUTHOR", "SUSPEND_AUTHOR", "REVOKE_AUTHOR_VERIFICATION"} {
		err := Handler{}.Execute(context.Background(), Command{Staff: staff, ReportId: "x", Action: action, Reason: "breaks the policy"})
		var apiError *httpserver.ApiError
		if !errors.As(err, &apiError) || apiError.Code != "STEP_UP_REQUIRED" {
			t.Fatalf("%s without step-up must be refused, got %v", action, err)
		}
	}
}

func TestStrikeBearingContentActionsNeedAStrikePermission(t *testing.T) {
	staff := staffauth.Staff{Id: "00000000-0000-0000-0000-000000000001", Permissions: []string{"moderation:reports"}, SteppedUp: true}
	for _, action := range []string{"REMOVE", "WARN_AUTHOR", "SUSPEND_AUTHOR"} {
		err := Handler{}.Execute(context.Background(), Command{Staff: staff, ReportId: "x", Action: action, Reason: "breaks the policy"})
		if !errors.Is(err, httpserver.ErrForbidden) {
			t.Fatalf("%s with only moderation:reports must be forbidden, got %v", action, err)
		}
	}
}

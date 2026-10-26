package decideappeal

import (
	"context"
	"errors"
	"testing"

	"nantty/platform/httpserver"
	"nantty/platform/staffauth"
)

func TestOverturningAnAppealRequiresStepUp(t *testing.T) {
	staff := staffauth.Staff{Id: "00000000-0000-0000-0000-000000000001", Permissions: []string{"moderation:appeals"}}
	err := Handler{}.Execute(context.Background(), Command{Staff: staff, AppealId: "x", Outcome: "OVERTURNED", Reason: "the content was fine"})
	var apiError *httpserver.ApiError
	if !errors.As(err, &apiError) || apiError.Code != "STEP_UP_REQUIRED" {
		t.Fatalf("overturn without step-up must be refused, got %v", err)
	}
}

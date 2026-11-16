package stage_test

import (
	"strings"
	"testing"

	"nantty/modules/live/src/modules/stage/dtos"
	"nantty/modules/live/src/modules/stage/validators"
)

func TestValidateInviteGuestRequestAllowsSpeakerAndCoHostWithOptionalTitle(t *testing.T) {
	for _, role := range []string{"", "speaker", "cohost"} {
		err := validators.ValidateInviteGuestRequest(dtos.InviteGuestRequest{
			UserId: "2d4e9f80-e115-48f3-837f-c1e4af778555",
			Role:   role,
			Title:  "  Guest expert  ",
		})
		if err != nil {
			t.Errorf("role %q should be valid: %v", role, err)
		}
	}
}

func TestValidateInviteGuestRequestRejectsInvalidRoleAndUnsafeTitle(t *testing.T) {
	tests := []struct {
		name string
		body dtos.InviteGuestRequest
	}{
		{name: "unknown role", body: dtos.InviteGuestRequest{UserId: "2d4e9f80-e115-48f3-837f-c1e4af778555", Role: "admin"}},
		{name: "long title", body: dtos.InviteGuestRequest{UserId: "2d4e9f80-e115-48f3-837f-c1e4af778555", Title: strings.Repeat("x", 33)}},
		{name: "control character", body: dtos.InviteGuestRequest{UserId: "2d4e9f80-e115-48f3-837f-c1e4af778555", Title: "speaker\nadmin"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := validators.ValidateInviteGuestRequest(test.body); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

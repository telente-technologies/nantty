package services

import (
	"testing"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	"nantty/modules/users/src/types"
)

func TestApplyLinkedStateCombinesPublishingAndLinkedProfileHolds(t *testing.T) {
	for _, testCase := range []struct {
		name           string
		publishingHeld bool
		status         linkedprofile.Status
		wantOnHold     bool
	}{
		{name: "active linked profile without publishing hold", status: linkedprofile.StatusActive, wantOnHold: false},
		{name: "inactive linked profile", status: linkedprofile.StatusHeld, wantOnHold: true},
		{name: "publishing hold on active linked profile", publishingHeld: true, status: linkedprofile.StatusActive, wantOnHold: true},
		{name: "both hold signals", publishingHeld: true, status: linkedprofile.StatusHeld, wantOnHold: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			view := types.ActingProfileView{OnHold: testCase.publishingHeld}
			row := &ent.LinkedProfile{Kind: linkedprofile.KindBusiness, Status: testCase.status}
			got := ApplyLinkedState(view, row, false)
			if got.OnHold != testCase.wantOnHold {
				t.Fatalf("OnHold = %t, want %t", got.OnHold, testCase.wantOnHold)
			}
		})
	}
}

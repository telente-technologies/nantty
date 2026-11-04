package types

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/platform/identityports"
)

func TestBuildUserViewHidesPrivateFieldsFromOtherUsers(t *testing.T) {
	email := "ada@example.com"
	birthday := time.Date(1990, 1, 2, 0, 0, 0, 0, time.UTC)
	row := &ent.Profile{ID: uuid.New(), AccountID: uuid.New(), Handle: "ada", DisplayName: "Ada", IsPrivate: true, CreatorStatus: profile.CreatorStatusApproved}
	summary := identityports.AccountSummary{ID: row.AccountID, Email: &email, Birthday: &birthday, Roles: []string{"buyer", "seller"}, EmailVerified: true, CreatedAt: time.Now()}
	cases := []struct {
		name         string
		includePrivt bool
		wantEmail    bool
	}{{"owner sees account details", true, true}, {"others never see account details", false, false}}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			view := BuildUserView(row, summary, testCase.includePrivt)
			if (view.Email != nil) != testCase.wantEmail || (view.Birthday != nil) != testCase.wantEmail || (view.Roles != nil) != testCase.wantEmail {
				t.Fatalf("unexpected visibility: %+v", view)
			}
			if !view.IsPrivate || !view.IsCreator || !view.IsSeller || view.Verified || view.CreatorStatus != "approved" {
				t.Fatalf("unexpected flags: %+v", view)
			}
		})
	}
}

func TestActingProfileViewUsesMobileKindNames(t *testing.T) {
	for kind, want := range map[profile.Kind]string{profile.KindPersonal: "person", profile.KindBusiness: "business"} {
		row := &ent.Profile{ID: uuid.New(), Kind: kind, Handle: "h"}
		view := BuildActingProfileView(row, row.ID.String())
		if view.Kind != want || view.Type != string(kind) || !view.Active {
			t.Errorf("%s: got %+v", kind, view)
		}
	}
}

func TestBuildActingProfileViewExposesPublishingHold(t *testing.T) {
	for _, testCase := range []struct {
		name           string
		publishingHeld bool
		wantOnHold     bool
	}{
		{name: "publishing held", publishingHeld: true, wantOnHold: true},
		{name: "publishing allowed", publishingHeld: false, wantOnHold: false},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			row := &ent.Profile{ID: uuid.New(), Kind: profile.KindBusiness, PublishingHeld: testCase.publishingHeld}
			view := BuildActingProfileView(row, "")
			if view.OnHold != testCase.wantOnHold {
				t.Fatalf("OnHold = %t, want %t", view.OnHold, testCase.wantOnHold)
			}
		})
	}
}

func TestCreatorFlagFollowsApprovedStatusOnly(t *testing.T) {
	summary := identityports.AccountSummary{CreatedAt: time.Now()}
	for status, want := range map[profile.CreatorStatus]bool{profile.CreatorStatusNone: false, profile.CreatorStatusPending: false, profile.CreatorStatusRejected: false, profile.CreatorStatusApproved: true} {
		view := BuildUserView(&ent.Profile{ID: uuid.New(), AccountID: uuid.New(), Handle: "h", CreatorStatus: status}, summary, false)
		if view.IsCreator != want || view.CreatorStatus != string(status) {
			t.Errorf("%s: got %+v", status, view)
		}
	}
}

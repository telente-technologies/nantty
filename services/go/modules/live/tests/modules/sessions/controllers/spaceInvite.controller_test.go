package controllers_test

import (
	"strings"
	"testing"

	"nantty/modules/live/src/modules/sessions/controllers"
)

func TestNormalizeSpaceInviteRole(t *testing.T) {
	for _, test := range []struct {
		input, want string
		valid       bool
	}{
		{"", "listener", true},
		{"listener", "listener", true},
		{"speaker", "speaker", true},
		{"cohost", "moderator", true},
		{"moderator", "moderator", true},
		{"admin", "", false},
	} {
		got, valid := controllers.NormalizeSpaceInviteRole(test.input)
		if got != test.want || valid != test.valid {
			t.Errorf("normalizeSpaceInviteRole(%q) = %q, %v; want %q, %v", test.input, got, valid, test.want, test.valid)
		}
	}
}

func TestNormalizeSpaceStageTitle(t *testing.T) {
	if got, ok := controllers.NormalizeSpaceStageTitle("  Community co-host  "); !ok || got != "Community co-host" {
		t.Fatalf("normalized title = %q, %v", got, ok)
	}
	if _, ok := controllers.NormalizeSpaceStageTitle(strings.Repeat("a", 61)); ok {
		t.Fatal("title above 60 characters should be rejected")
	}
	if _, ok := controllers.NormalizeSpaceStageTitle("speaker\nadmin"); ok {
		t.Fatal("control characters should be rejected")
	}
}

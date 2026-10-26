package services

import (
	"testing"
	"time"

	"nantty/modules/moderation/src/generated/ent"
)

func TestStrikesExpireAfterTwelveMonthsAndWarningsAfterSix(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	if got := ExpiryFor("strike", now, 0); !got.Equal(time.Date(2027, 10, 3, 12, 0, 0, 0, time.UTC)) {
		t.Fatalf("strike expiry %v", got)
	}
	if got := ExpiryFor("warning", now, 0); !got.Equal(time.Date(2027, 4, 3, 12, 0, 0, 0, time.UTC)) {
		t.Fatalf("warning expiry %v", got)
	}
	if got := ExpiryFor("strike", now, 30); !got.Equal(now.AddDate(0, 0, 30)) {
		t.Fatalf("override expiry %v", got)
	}
}

func TestStatusAtTreatsRevokedBeforeExpiredBeforeActive(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	past, future := now.Add(-time.Hour), now.Add(time.Hour)
	cases := []struct {
		name string
		row  ent.Strike
		want string
	}{
		{"active", ent.Strike{ExpiresAt: &future}, "active"},
		{"never expires", ent.Strike{}, "active"},
		{"expired", ent.Strike{ExpiresAt: &past}, "expired"},
		{"expiry boundary counts as expired", ent.Strike{ExpiresAt: &now}, "expired"},
		{"revoked wins", ent.Strike{ExpiresAt: &past, RevokedAt: &past}, "revoked"},
	}
	for _, testCase := range cases {
		if got := StatusAt(&testCase.row, now); got != testCase.want {
			t.Errorf("%s: got %s", testCase.name, got)
		}
	}
}

func TestRepeatInfringerFromThreeActiveStrikesAndSourceMapping(t *testing.T) {
	if IsRepeatInfringer(2) || !IsRepeatInfringer(3) {
		t.Fatal("repeat infringer threshold is three active strikes")
	}
	if AdminSource("copyright") != "COPYRIGHT" || AdminSource("manual") != "MANUAL" || AdminSource("ip_claim") != "MODERATION" || AdminSource("moderation") != "MODERATION" {
		t.Fatal("admin sources map to the console enum")
	}
	if ReferenceKey("report", "", "strike") != nil || *ReferenceKey("report", "r1", "strike") != "report:r1:strike" {
		t.Fatal("reference keys make issuing idempotent only when a reference exists")
	}
}

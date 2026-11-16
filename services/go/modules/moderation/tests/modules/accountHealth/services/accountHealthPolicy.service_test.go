package services_test

import (
	"testing"
	"time"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/strike"
	"nantty/modules/moderation/src/modules/accountHealth/services"
	copyrightservices "nantty/modules/moderation/src/modules/copyrightClaims/services"
)

var now = time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)

func copyrightStrike(issuedDaysAgo, lifetimeDays int) *ent.Strike {
	issued := now.AddDate(0, 0, -issuedDaysAgo)
	expires := issued.AddDate(0, 0, lifetimeDays)
	return &ent.Strike{Kind: strike.KindStrike, Source: strike.SourceCopyright, CreatedAt: issued, ExpiresAt: &expires}
}

func TestHealthStatusMovesFromGoodStandingToAtRiskToRestricted(t *testing.T) {
	settings := copyrightservices.DefaultPolicySettings()
	cases := []struct {
		name  string
		input services.StandingInput
		want  string
	}{
		{"clean account", services.StandingInput{}, services.StatusGoodStanding},
		{"pending takedown deadline", services.StandingInput{PendingTakedowns: 1}, services.StatusAtRisk},
		{"one strike", services.StandingInput{ActiveStrikes: 1, CopyrightStrikesInWindow: 1}, services.StatusAtRisk},
		{"repeat copyright infringement", services.StandingInput{ActiveStrikes: 2, CopyrightStrikesInWindow: 2}, services.StatusRestricted},
		{"two strikes from other policies", services.StandingInput{ActiveStrikes: 2}, services.StatusAtRisk},
		{"three copyright strikes in the window", services.StandingInput{ActiveStrikes: 3, CopyrightStrikesInWindow: 3}, services.StatusRestricted},
		{"three strikes from any policy", services.StandingInput{ActiveStrikes: 3}, services.StatusRestricted},
	}
	for _, testCase := range cases {
		if got := services.ComputeStanding(testCase.input, settings); got.Status != testCase.want {
			t.Errorf("%s: got %s want %s", testCase.name, got.Status, testCase.want)
		}
	}
	restricted := services.ComputeStanding(services.StandingInput{ActiveStrikes: 3, CopyrightStrikesInWindow: 3}, settings)
	if restricted.CanMonetise || restricted.CanGoLive || len(restricted.Restrictions) != 2 || !restricted.NeedsSuspensionReview {
		t.Fatalf("restricted accounts lose monetisation and live and go to suspension review: %+v", restricted)
	}
}

func TestThresholdsAreAdminConfigurable(t *testing.T) {
	settings := copyrightservices.DefaultPolicySettings()
	settings.RestrictionThreshold, settings.SuspensionReviewThreshold = 1, 4
	standing := services.ComputeStanding(services.StandingInput{ActiveStrikes: 1, CopyrightStrikesInWindow: 1}, settings)
	if standing.Status != services.StatusRestricted || standing.NeedsSuspensionReview {
		t.Fatalf("a lower restriction threshold restricts earlier and review waits for its own threshold: %+v", standing)
	}
}

func TestStrikesOutsideTheWindowOrExpiredDoNotCount(t *testing.T) {
	revokedAt := now.Add(-time.Hour)
	revoked := copyrightStrike(5, 90)
	revoked.RevokedAt = &revokedAt
	warning := copyrightStrike(5, 180)
	warning.Kind = strike.KindWarning
	moderation := copyrightStrike(5, 90)
	moderation.Source = strike.SourceModeration
	rows := []*ent.Strike{copyrightStrike(10, 90), copyrightStrike(89, 90), copyrightStrike(91, 90), copyrightStrike(100, 365), revoked, warning, moderation}
	if got := services.CountCopyrightStrikesInWindow(rows, now, 90); got != 2 {
		t.Fatalf("expired, out-of-window, revoked, warning and non-copyright rows are excluded: %d", got)
	}
	if got := services.CountActiveStrikes(rows, now); got != 4 {
		t.Fatalf("active strikes from any source: %d", got)
	}
	if got := services.CountCopyrightStrikesInWindow(rows, now.AddDate(0, 0, 2), 90); got != 1 {
		t.Fatalf("a strike drops off after its 90-day lifetime: %d", got)
	}
}

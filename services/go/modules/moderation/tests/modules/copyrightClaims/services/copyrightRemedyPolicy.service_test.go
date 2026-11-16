package services_test

import (
	"testing"
	"time"

	"nantty/modules/moderation/src/modules/copyrightClaims/services"
)

func TestRemedyDependsOnClaimScopeTargetAndKnownUploader(t *testing.T) {
	cases := []struct {
		scope, target string
		known         bool
		want          string
	}{
		{"audio", "clip", true, services.RemedyAudioMuted},
		{"audio", "sound", true, services.RemedyAudioMuted},
		{"audio", "post", true, services.RemedyAudioMuted},
		{"video", "clip", true, services.RemedyTakedownWarning},
		{"video", "post", true, services.RemedyTakedownWarning},
		{"audio", "live", true, services.RemedyTakenDown},
		{"video", "live", true, services.RemedyTakenDown},
		{"video", "clip", false, services.RemedyTakenDown},
	}
	for _, testCase := range cases {
		if got := services.RemedyForUpheldClaim(testCase.scope, testCase.target, testCase.known); got != testCase.want {
			t.Errorf("%s/%s known=%v: got %s want %s", testCase.scope, testCase.target, testCase.known, got, testCase.want)
		}
	}
}

func TestTakedownDeadlineDefaultsToFortyEightHoursAndIsConfigurable(t *testing.T) {
	decided := time.Date(2026, 10, 4, 9, 0, 0, 0, time.UTC)
	if got := services.TakedownDeadlineFrom(decided, services.DefaultPolicySettings()); !got.Equal(decided.Add(48 * time.Hour)) {
		t.Fatalf("default deadline %v", got)
	}
	settings := services.DefaultPolicySettings()
	settings.TakedownDeadlineHours = 24
	if got := services.TakedownDeadlineFrom(decided, settings); !got.Equal(decided.Add(24 * time.Hour)) {
		t.Fatalf("configured deadline %v", got)
	}
}

func TestOverdueOnlyWhileAwaitingRemovalAndNotUnderCounterNotice(t *testing.T) {
	now := time.Date(2026, 10, 6, 9, 0, 0, 0, time.UTC)
	past, future := now.Add(-time.Minute), now.Add(time.Minute)
	if !services.IsTakedownOverdue("awaiting_removal", "upheld", &past, now) || !services.IsTakedownOverdue("awaiting_removal", "upheld", &now, now) {
		t.Fatal("a passed deadline is overdue")
	}
	if services.IsTakedownOverdue("awaiting_removal", "upheld", &future, now) || services.IsTakedownOverdue("removed_voluntarily", "upheld", &past, now) || services.IsTakedownOverdue("awaiting_removal", "counter_notice", &past, now) || services.IsTakedownOverdue("awaiting_removal", "upheld", nil, now) {
		t.Fatal("future deadlines, voluntary removals and pending counter-notices are not overdue")
	}
}

func TestVoluntaryRemovalMustBeatTheDeadline(t *testing.T) {
	deadline := time.Date(2026, 10, 6, 9, 0, 0, 0, time.UTC)
	if !services.CanRecordVoluntaryRemoval("awaiting_removal", &deadline, deadline.Add(-time.Hour)) {
		t.Fatal("removal before the deadline is voluntary")
	}
	if services.CanRecordVoluntaryRemoval("awaiting_removal", &deadline, deadline.Add(time.Second)) || services.CanRecordVoluntaryRemoval("taken_down", &deadline, deadline.Add(-time.Hour)) {
		t.Fatal("late removals and already-enforced claims are not voluntary")
	}
}

func TestPolicySettingsValidationRejectsOutOfRangeValues(t *testing.T) {
	if _, ok := services.ValidatePolicySettings(services.DefaultPolicySettings()); !ok {
		t.Fatal("defaults are valid")
	}
	settings := services.DefaultPolicySettings()
	settings.RestrictionDays = 120
	if field, ok := services.ValidatePolicySettings(settings); ok || field != "restrictionDays" {
		t.Fatalf("restrictions are capped at 90 days by the account service: %s", field)
	}
}

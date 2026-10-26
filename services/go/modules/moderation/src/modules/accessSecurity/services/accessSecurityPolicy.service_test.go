package services

import (
	"testing"

	"nantty/modules/moderation/src/configs"
)

var thresholds = EffectiveThresholds(configs.AccessSecuritySettings{})

func TestFirstViolationRequiresAChallengeAndOpensACase(t *testing.T) {
	decision := DecideAfterAccessViolation(false, RecentHistory{Violations: 1}, thresholds)
	if !decision.RequireChallenge || !decision.OpenCase || decision.Suspend {
		t.Fatalf("got %+v", decision)
	}
}

func TestContinuedProbingAfterThreeChallengesSuspends(t *testing.T) {
	if decision := DecideAfterAccessViolation(false, RecentHistory{Violations: 4, ChallengesRequired: 2}, thresholds); decision.Suspend {
		t.Fatalf("two challenges must not suspend: %+v", decision)
	}
	if decision := DecideAfterAccessViolation(false, RecentHistory{Violations: 4, ChallengesRequired: 3}, thresholds); !decision.Suspend {
		t.Fatalf("three challenges then probing must suspend: %+v", decision)
	}
}

func TestFiveFailedChallengesSuspendButFourDoNot(t *testing.T) {
	if decision := DecideAfterChallengeOutcome(false, false, RecentHistory{FailedChallenges: 4}, thresholds); decision.Suspend {
		t.Fatalf("four failures must not suspend: %+v", decision)
	}
	if decision := DecideAfterChallengeOutcome(false, false, RecentHistory{FailedChallenges: 5}, thresholds); !decision.Suspend {
		t.Fatalf("five failures must suspend: %+v", decision)
	}
}

func TestPassingClearsAndSuspendedAccountsAreLeftAlone(t *testing.T) {
	if decision := DecideAfterChallengeOutcome(true, false, RecentHistory{FailedChallenges: 9}, thresholds); !decision.ClearChallenge || decision.Suspend {
		t.Fatalf("got %+v", decision)
	}
	if decision := DecideAfterAccessViolation(true, RecentHistory{ChallengesRequired: 9}, thresholds); decision != (PolicyDecision{}) {
		t.Fatalf("suspended accounts get no further automation: %+v", decision)
	}
}

func TestSuspectedBotPolicyIsDeterministic(t *testing.T) {
	cases := []struct {
		name     string
		evidence BotEvidence
		want     bool
	}{
		{"high score with two independent signals", BotEvidence{Score: 0.9, ReasonCodes: []string{"robotic_cadence", "follow_burst"}}, true},
		{"high score with one signal is not enough", BotEvidence{Score: 0.95, ReasonCodes: []string{"robotic_cadence", "robotic_cadence"}}, false},
		{"failed attestation with a moderate score", BotEvidence{Score: 0.65, AttestationVerdict: "failed"}, true},
		{"headless client with a moderate score", BotEvidence{Score: 0.6, HeadlessReported: true}, true},
		{"headless client alone with a low score", BotEvidence{Score: 0.2, HeadlessReported: true}, false},
		{"low score", BotEvidence{Score: 0.3, ReasonCodes: []string{"a", "b", "c"}}, false},
	}
	for _, testCase := range cases {
		for range 3 {
			if got, _ := DecideSuspectedBot(testCase.evidence, thresholds); got != testCase.want {
				t.Fatalf("%s: got %v want %v", testCase.name, got, testCase.want)
			}
		}
	}
}

func TestBotsAreChallengedOnEveryActionAndFlagsOnce(t *testing.T) {
	if requirement, _ := ChallengeRequirement(false, true, false); requirement != RequirementEveryAction {
		t.Fatalf("bot requirement = %s", requirement)
	}
	if requirement, _ := ChallengeRequirement(false, false, true); requirement != RequirementOnce {
		t.Fatalf("flag requirement = %s", requirement)
	}
	if requirement, _ := ChallengeRequirement(true, true, true); requirement != RequirementNone {
		t.Fatalf("suspended requirement = %s", requirement)
	}
}

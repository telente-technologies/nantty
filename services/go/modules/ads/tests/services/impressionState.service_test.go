package services_test

import (
	"testing"

	"nantty/modules/ads/src/services"
)

func cpmClaims() services.AdTokenClaims {
	return services.AdTokenClaims{Basis: services.BasisCpm, PriceMicros: 100_000, QualifyWatchMs: 1_000, QualifyVisiblePct: 50, CreatorUserId: "creator", CreatorShareBps: 4_000, MultiplierBps: 10_000}
}

var cleanVerdict = services.FraudVerdict{Status: services.FraudStatusClean}

func apply(state services.ImpressionState, claims services.AdTokenClaims, input services.AdEventInput) (services.ImpressionState, services.EventEffects) {
	if input.Verdict.Status == "" {
		input.Verdict = cleanVerdict
	}
	return services.ApplyAdEventToImpression(state, claims, input)
}

func TestImpressionEventsAreDedupedSoRetriesNeverDoubleCount(t *testing.T) {
	state, first := apply(services.ImpressionState{}, cpmClaims(), services.AdEventInput{Kind: services.EventKindImpression})
	_, second := apply(state, cpmClaims(), services.AdEventInput{Kind: services.EventKindImpression})
	if !first.CountImpression || second.CountImpression {
		t.Fatalf("only the first impression event counts: %+v %+v", first, second)
	}
}

func TestCpmChargeHappensOnceWhenTheViewQualifies(t *testing.T) {
	claims := cpmClaims()
	state, early := apply(services.ImpressionState{}, claims, services.AdEventInput{Kind: services.EventKindView, WatchMs: 400, VisiblePercent: 80})
	if early.NowQualified || early.Charge.ChargeMicros != 0 {
		t.Fatalf("0.4s is below the floor: %+v", early)
	}
	state, qualified := apply(state, claims, services.AdEventInput{Kind: services.EventKindView, WatchMs: 1_200, VisiblePercent: 80})
	if !qualified.NowQualified || qualified.Charge.ChargeMicros != 100_000 || qualified.Charge.CreatorMicros != 40_000 {
		t.Fatalf("expected a split charge, got %+v", qualified)
	}
	_, replay := apply(state, claims, services.AdEventInput{Kind: services.EventKindView, WatchMs: 5_000, VisiblePercent: 100})
	if replay.NowQualified || replay.Charge.ChargeMicros != 0 {
		t.Fatalf("a qualified impression must never be charged twice: %+v", replay)
	}
}

func TestInsufficientVisibilityDoesNotQualify(t *testing.T) {
	_, effects := apply(services.ImpressionState{}, cpmClaims(), services.AdEventInput{Kind: services.EventKindView, WatchMs: 3_000, VisiblePercent: 20})
	if effects.NowQualified || effects.Charge.ChargeMicros != 0 {
		t.Fatalf("20%% visible must not qualify: %+v", effects)
	}
}

func TestCpcChargesOnlyTheFirstValidClick(t *testing.T) {
	claims := cpmClaims()
	claims.Basis, claims.PriceMicros = services.BasisCpc, 5_000_000
	state, first := apply(services.ImpressionState{}, claims, services.AdEventInput{Kind: services.EventKindClick})
	_, second := apply(state, claims, services.AdEventInput{Kind: services.EventKindClick})
	if !first.CountClick || first.Charge.ChargeMicros != 5_000_000 || second.CountClick || second.Charge.ChargeMicros != 0 {
		t.Fatalf("first click charges once: %+v %+v", first, second)
	}
}

func TestInvalidTrafficIsNeverChargedAndStaysInvalid(t *testing.T) {
	claims := cpmClaims()
	bot := services.AdEventInput{Kind: services.EventKindView, WatchMs: 5_000, VisiblePercent: 100, Verdict: services.FraudVerdict{Status: services.FraudStatusInvalid, Reason: "bot_user_agent"}}
	state, effects := apply(services.ImpressionState{}, claims, bot)
	if effects.Charge.ChargeMicros != 0 || state.FraudStatus != services.FraudStatusInvalid || effects.InvalidReason != "bot_user_agent" {
		t.Fatalf("invalid event must not be charged: %+v %+v", state, effects)
	}
	_, later := apply(state, claims, services.AdEventInput{Kind: services.EventKindView, WatchMs: 9_000, VisiblePercent: 100})
	if later.Charge.ChargeMicros != 0 || later.NowQualified {
		t.Fatalf("a flagged impression stays invalid: %+v", later)
	}
}

func TestFraudPolicyDeterministicRulesWinAndModelScoreIsAdvisory(t *testing.T) {
	thresholds := services.DefaultFraudThresholds()
	if verdict := services.EvaluateFraudPolicy(services.FraudSignals{EventKind: "click", MillisSinceServed: 100}, thresholds); verdict.Status != services.FraudStatusInvalid || verdict.Reason != "click_too_fast" {
		t.Fatalf("instant clicks are invalid: %+v", verdict)
	}
	if verdict := services.EvaluateFraudPolicy(services.FraudSignals{EventKind: "click", MillisSinceServed: 5_000, ClicksByViewerLastMinute: 20}, thresholds); verdict.Reason != "click_velocity" {
		t.Fatalf("click velocity must invalidate: %+v", verdict)
	}
	low, high := 0.2, 0.97
	if verdict := services.EvaluateFraudPolicy(services.FraudSignals{EventKind: "view", ModelScore: &low}, thresholds); verdict.Status != services.FraudStatusClean || verdict.Score != 0.2 {
		t.Fatalf("low model score stays clean: %+v", verdict)
	}
	if verdict := services.EvaluateFraudPolicy(services.FraudSignals{EventKind: "view", ModelScore: &high}, thresholds); verdict.Status != services.FraudStatusInvalid || verdict.Reason != "model_score" {
		t.Fatalf("high model score invalidates: %+v", verdict)
	}
	if verdict := services.EvaluateFraudPolicy(services.FraudSignals{EventKind: "view"}, thresholds); verdict.Status != services.FraudStatusClean {
		t.Fatalf("model unavailable falls back to the deterministic policy: %+v", verdict)
	}
}

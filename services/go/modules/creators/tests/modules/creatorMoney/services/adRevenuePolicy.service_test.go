package services_test

import (
	"encoding/json"
	"testing"

	"nantty/modules/creators/src/modules/creatorMoney/services"
)

func TestAdRevenuePolicyReportsTheEffectiveShareByContentType(t *testing.T) {
	policy := services.BuildAdRevenuePolicy(nil, false, 4_000)
	if policy.BaseShareBasisPoints != 4_000 || len(policy.Rules) != 2 {
		t.Fatalf("unexpected defaults: %+v", policy)
	}
	if policy.Rules[0].ContentType != "original" || policy.Rules[0].MultiplierBasisPoints != 10_000 || policy.Rules[0].EffectiveShareBasisPoints != 4_000 {
		t.Fatalf("original content rate mismatch: %+v", policy.Rules[0])
	}
	if policy.Rules[1].ContentType != "ai_generated" || policy.Rules[1].MultiplierBasisPoints != 3_000 || policy.Rules[1].EffectiveShareBasisPoints != 1_200 {
		t.Fatalf("AI content rate mismatch: %+v", policy.Rules[1])
	}
	if policy.CalculationNote == "" {
		t.Fatal("the API must explain settlement basis and that this is not a per-view payment")
	}
}

func TestAdRevenuePolicyUsesActiveAdminMultipliersAndCapsEffectiveShare(t *testing.T) {
	raw := json.RawMessage(`{"rows":[{"id":"original","multiplierBps":15000,"active":true},{"id":"ai_generated","multiplierBps":3000,"active":false}]}`)
	policy := services.BuildAdRevenuePolicy(raw, true, 8_000)
	if policy.Rules[0].MultiplierBasisPoints != 15_000 || policy.Rules[0].EffectiveShareBasisPoints != 10_000 {
		t.Fatalf("effective rate must match the delivery split cap: %+v", policy.Rules[0])
	}
	if policy.Rules[1].MultiplierBasisPoints != 3_000 || policy.Rules[1].EffectiveShareBasisPoints != 2_400 {
		t.Fatalf("inactive policy rows must retain the runtime fallback: %+v", policy.Rules[1])
	}
}

func TestAdRevenuePolicyRejectsInvalidMultiplierAndClampsBaseRate(t *testing.T) {
	raw := json.RawMessage(`{"rows":[{"id":"original","multiplierBps":30001,"active":true}]}`)
	policy := services.BuildAdRevenuePolicy(raw, true, 12_000)
	if policy.BaseShareBasisPoints != 10_000 || policy.Rules[0].MultiplierBasisPoints != 10_000 || policy.Rules[0].EffectiveShareBasisPoints != 10_000 {
		t.Fatalf("invalid policy values must not exceed runtime bounds: %+v", policy)
	}
}

package validators_test

import (
	"testing"

	"nantty/modules/moderation/src/modules/copyrightClaims/validators"
	"nantty/platform/httpserver"
)

func validEvidence() validators.ClaimEvidence {
	return validators.ClaimEvidence{
		TargetType: "clip", ClaimScope: "audio", ClaimantName: "Ada Obi", OriginalWorkUrl: "https://music.example/lagos-nights", ProofUrls: []string{"https://registry.example/cert/1"},
		Segments: []validators.Segment{{StartSeconds: 3, EndSeconds: 28}}, AccuracyDeclared: true, SignatureName: "ada obi",
	}
}

func TestValidEvidencePassesAndSignatureIsCaseInsensitive(t *testing.T) {
	if err := validators.ValidateClaimEvidence(validEvidence()); err != nil {
		t.Fatalf("unexpected %v", err)
	}
}

func TestEvidenceRulesRejectMissingProofAndBadSegments(t *testing.T) {
	cases := map[string]func(*validators.ClaimEvidence){
		"no original work":        func(e *validators.ClaimEvidence) { e.OriginalWorkUrl = "" },
		"no proof":                func(e *validators.ClaimEvidence) { e.ProofUrls = nil },
		"javascript proof link":   func(e *validators.ClaimEvidence) { e.ProofUrls = []string{"javascript:alert(1)"} },
		"no accuracy declaration": func(e *validators.ClaimEvidence) { e.AccuracyDeclared = false },
		"signature mismatch":      func(e *validators.ClaimEvidence) { e.SignatureName = "Someone Else" },
		"missing signature":       func(e *validators.ClaimEvidence) { e.SignatureName = "" },
		"no segments on a clip":   func(e *validators.ClaimEvidence) { e.Segments = nil },
		"segment ends before start": func(e *validators.ClaimEvidence) {
			e.Segments = []validators.Segment{{StartSeconds: 10, EndSeconds: 4}}
		},
		"unknown scope": func(e *validators.ClaimEvidence) { e.ClaimScope = "image" },
	}
	for name, mutate := range cases {
		evidence := validEvidence()
		mutate(&evidence)
		if err := validators.ValidateClaimEvidence(evidence); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
}

func TestSoundClaimsMayOmitSegmentsAndScopeDefaultsFromTarget(t *testing.T) {
	evidence := validEvidence()
	evidence.TargetType, evidence.Segments, evidence.OriginalWorkUrl, evidence.OriginalWorkMediaId = "sound", nil, "", "0192f0a1-0000-7000-8000-000000000001"
	if err := validators.ValidateClaimEvidence(evidence); err != nil {
		t.Fatalf("a whole-sound claim with an uploaded original is valid: %v", err)
	}
	if validators.ScopeFor("sound", "") != "audio" || validators.ScopeFor("clip", "") != "video" || validators.ScopeFor("clip", "audio") != "audio" {
		t.Fatal("scope defaults: sounds are audio claims, everything else video unless declared")
	}
	evidence.AccuracyDeclared = false
	if apiError, ok := validators.ValidateClaimEvidence(evidence).(*httpserver.ApiError); !ok || apiError.Code != "ACCURACY_DECLARATION_REQUIRED" {
		t.Fatalf("declaration errors carry a stable code: %v", apiError)
	}
}

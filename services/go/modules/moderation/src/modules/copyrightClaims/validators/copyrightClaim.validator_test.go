package validators

import (
	"testing"

	"zudomart/platform/httpserver"
)

func validEvidence() ClaimEvidence {
	return ClaimEvidence{
		TargetType: "clip", ClaimScope: "audio", ClaimantName: "Ada Obi", OriginalWorkUrl: "https://music.example/lagos-nights", ProofUrls: []string{"https://registry.example/cert/1"},
		Segments: []Segment{{StartSeconds: 3, EndSeconds: 28}}, AccuracyDeclared: true, SignatureName: "ada obi",
	}
}

func TestValidEvidencePassesAndSignatureIsCaseInsensitive(t *testing.T) {
	if err := ValidateClaimEvidence(validEvidence()); err != nil {
		t.Fatalf("unexpected %v", err)
	}
}

func TestEvidenceRulesRejectMissingProofAndBadSegments(t *testing.T) {
	cases := map[string]func(*ClaimEvidence){
		"no original work":          func(e *ClaimEvidence) { e.OriginalWorkUrl = "" },
		"no proof":                  func(e *ClaimEvidence) { e.ProofUrls = nil },
		"javascript proof link":     func(e *ClaimEvidence) { e.ProofUrls = []string{"javascript:alert(1)"} },
		"no accuracy declaration":   func(e *ClaimEvidence) { e.AccuracyDeclared = false },
		"signature mismatch":        func(e *ClaimEvidence) { e.SignatureName = "Someone Else" },
		"missing signature":         func(e *ClaimEvidence) { e.SignatureName = "" },
		"no segments on a clip":     func(e *ClaimEvidence) { e.Segments = nil },
		"segment ends before start": func(e *ClaimEvidence) { e.Segments = []Segment{{StartSeconds: 10, EndSeconds: 4}} },
		"unknown scope":             func(e *ClaimEvidence) { e.ClaimScope = "image" },
	}
	for name, mutate := range cases {
		evidence := validEvidence()
		mutate(&evidence)
		if err := ValidateClaimEvidence(evidence); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
}

func TestSoundClaimsMayOmitSegmentsAndScopeDefaultsFromTarget(t *testing.T) {
	evidence := validEvidence()
	evidence.TargetType, evidence.Segments, evidence.OriginalWorkUrl, evidence.OriginalWorkMediaId = "sound", nil, "", "0192f0a1-0000-7000-8000-000000000001"
	if err := ValidateClaimEvidence(evidence); err != nil {
		t.Fatalf("a whole-sound claim with an uploaded original is valid: %v", err)
	}
	if ScopeFor("sound", "") != "audio" || ScopeFor("clip", "") != "video" || ScopeFor("clip", "audio") != "audio" {
		t.Fatal("scope defaults: sounds are audio claims, everything else video unless declared")
	}
	evidence.AccuracyDeclared = false
	if apiError, ok := ValidateClaimEvidence(evidence).(*httpserver.ApiError); !ok || apiError.Code != "ACCURACY_DECLARATION_REQUIRED" {
		t.Fatalf("declaration errors carry a stable code: %v", apiError)
	}
}

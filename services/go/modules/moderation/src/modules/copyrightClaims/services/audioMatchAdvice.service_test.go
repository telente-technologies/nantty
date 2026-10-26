package services

import (
	"encoding/json"
	"testing"

	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/integrations"
)

func TestAudioMatchAdviceBecomesAdviceOnlyMatchesWithSegments(t *testing.T) {
	preview, _ := json.Marshal(integrations.TargetPreview{OwnerId: "u1", MediaIds: []string{"m1", "m2"}})
	claim := &ent.CopyrightClaim{WorkTitle: "Lagos Nights", ClaimantName: "Ada Obi", ClaimantOrganization: "Kaz Records", TargetPreview: preview}
	if ids := TargetMediaIdsOf(claim); len(ids) != 2 || ids[0] != "m1" {
		t.Fatalf("target media ids come from the stored preview: %v", ids)
	}
	if TargetMediaIdsOf(&ent.CopyrightClaim{}) != nil {
		t.Fatal("claims without a preview have no media to match")
	}
	matches := AdviceToMatches(claim, integrations.AudioMatchAdviceResult{Available: true, Matches: []integrations.AudioMatchAdvice{{TargetMediaId: "m1", ConfidencePercent: 140, TargetStartSeconds: 2, TargetEndSeconds: 30, ReferenceStartSeconds: 41}}})
	if len(matches) != 1 || matches[0].ConfidencePercent != 100 || matches[0].Source != AudioMatchAdviceSource || matches[0].Artist != "Kaz Records" {
		t.Fatalf("unexpected %+v", matches)
	}
	var segment map[string]float64
	if json.Unmarshal(matches[0].Segments[0], &segment) != nil || segment["referenceStartSeconds"] != 41 || segment["targetEndSeconds"] != 30 {
		t.Fatalf("segments use the console shape: %s", matches[0].Segments[0])
	}
}

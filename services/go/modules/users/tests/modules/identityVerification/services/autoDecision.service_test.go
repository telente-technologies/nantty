package services_test

import (
	"slices"
	"testing"

	"nantty/modules/users/src/modules/identityVerification/services"
)

type (
	AutoDecisionInput       = services.AutoDecisionInput
	SmileVerificationResult = services.SmileVerificationResult
)

const (
	CheckPassed   = services.CheckPassed
	CheckFailed   = services.CheckFailed
	CheckReview   = services.CheckReview
	CheckNotDone  = services.CheckNotDone
	LookupMatched = services.LookupMatched
)

func cleanResult() SmileVerificationResult {
	return SmileVerificationResult{Liveness: CheckPassed, Document: CheckPassed, FaceMatch: CheckPassed, DatabaseLookup: LookupMatched, FaceMatchConfidence: 0.98}
}

func cleanInput() AutoDecisionInput {
	return AutoDecisionInput{Result: cleanResult(), NameMatchScore: 0.95, TrustScore: 80, EligibleAtPayment: true}
}

func TestAutoDecisionMatrix(t *testing.T) {
	cases := []struct {
		name        string
		change      func(*AutoDecisionInput)
		wantApprove bool
		wantReason  string
		wantSignal  string
	}{
		{"every check passes", func(*AutoDecisionInput) {}, true, "", ""},
		{"no government database for this ID still auto-approves", func(input *AutoDecisionInput) { input.Result.DatabaseLookup = CheckNotDone }, true, "", ""},
		{"failed liveness is a spoof signal and goes to review", func(input *AutoDecisionInput) {
			input.Result.Liveness, input.Result.SpoofSuspected = CheckFailed, true
		}, false, "liveness_not_passed", "spoof_attempt"},
		{"invalid document goes to review", func(input *AutoDecisionInput) { input.Result.Document = CheckFailed }, false, "document_not_valid", ""},
		{"face match under review goes to review", func(input *AutoDecisionInput) { input.Result.FaceMatch = CheckReview }, false, "face_match_not_passed", ""},
		{"NIN not found is flagged", func(input *AutoDecisionInput) { input.Result.DatabaseLookup = CheckFailed }, false, "government_lookup_not_matched", "id_number_not_found"},
		{"partial name match goes to review without a fraud signal", func(input *AutoDecisionInput) { input.NameMatchScore = 0.7 }, false, "name_does_not_match_profile", ""},
		{"a different name on a valid ID is an ID mismatch", func(input *AutoDecisionInput) { input.NameMatchScore = 0.2 }, false, "name_does_not_match_profile", "id_name_mismatch"},
		{"low trust goes to review", func(input *AutoDecisionInput) { input.TrustScore = 40 }, false, "trust_score_below_threshold", ""},
		{"blocked trust goes to review", func(input *AutoDecisionInput) { input.TrustBlocked = true }, false, "trust_score_below_threshold", ""},
		{"paid without being eligible goes to review", func(input *AutoDecisionInput) { input.EligibleAtPayment = false }, false, "not_eligible_when_paid", ""},
		{"ID reused by another account", func(input *AutoDecisionInput) { input.DocumentReusedByPeer = true }, false, "document_used_by_another_account", "id_reused_across_accounts"},
		{"gold without approved business documents", func(input *AutoDecisionInput) { input.IsGold = true }, false, "business_documents_not_approved", ""},
		{"gold with approved business documents", func(input *AutoDecisionInput) { input.IsGold, input.GoldBusinessApproved = true, true }, true, "", ""},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			input := cleanInput()
			testCase.change(&input)
			decision := services.DecideVerificationCase(input)
			if decision.Approve != testCase.wantApprove {
				t.Fatalf("approve = %v, reasons %v", decision.Approve, decision.Reasons)
			}
			if testCase.wantReason != "" && !slices.Contains(decision.Reasons, testCase.wantReason) {
				t.Fatalf("reasons %v missing %s", decision.Reasons, testCase.wantReason)
			}
			if testCase.wantSignal != "" && !slices.Contains(decision.FraudSignals, testCase.wantSignal) {
				t.Fatalf("signals %v missing %s", decision.FraudSignals, testCase.wantSignal)
			}
			if testCase.wantSignal == "" && len(decision.FraudSignals) > 0 {
				t.Fatalf("unexpected fraud signals %v", decision.FraudSignals)
			}
		})
	}
}

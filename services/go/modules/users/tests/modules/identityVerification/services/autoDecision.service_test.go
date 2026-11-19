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
	return AutoDecisionInput{Result: cleanResult(), Product: "document_verification", NameMatchScore: 0.95, TrustScore: 80, EligibleAtPayment: true}
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
		{"provider risk requires human review", func(input *AutoDecisionInput) { input.Result.ProviderRiskFlagged = true }, false, "provider_risk_requires_review", "provider_risk_flagged"},
		{"provider identity mismatch requires human review", func(input *AutoDecisionInput) { input.Result.SelectedIdentityMismatch = true }, false, "provider_identity_type_mismatch", ""},
		{"documented provider reason is recorded and requires review", func(input *AutoDecisionInput) { input.Result.ProviderReasonCode = "service_unavailable" }, false, "smile_reason_service_unavailable", ""},
		{"unrecognized provider reason fails closed without retaining its text", func(input *AutoDecisionInput) { input.Result.ProviderReasonUnrecognized = true }, false, "provider_result_reason_unrecognized", ""},
		{"unknown provider product fails closed", func(input *AutoDecisionInput) { input.Product = "unexpected_product" }, false, "unsupported_verification_product", ""},
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

func TestEnhancedDocumentVerificationRequiresAuthorityMatch(t *testing.T) {
	input := cleanInput()
	input.Product = "enhanced_document_verification"
	input.Result.DatabaseLookup = CheckNotDone
	if decision := services.DecideVerificationCase(input); decision.Approve || !slices.Contains(decision.Reasons, "government_lookup_not_matched") {
		t.Fatalf("Enhanced Document Verification must require its issuer check: %+v", decision)
	}
	input.Result.DatabaseLookup = LookupMatched
	if decision := services.DecideVerificationCase(input); !decision.Approve {
		t.Fatalf("a clear Enhanced Document Verification result may pass all independent Nantty checks: %+v", decision)
	}
}

func TestEnhancedKycRequiresMatchedGovernmentRecordWithoutInventingBiometricChecks(t *testing.T) {
	input := cleanInput()
	input.Product = "enhanced_kyc"
	input.Result = SmileVerificationResult{Liveness: CheckNotDone, Document: CheckNotDone, FaceMatch: CheckNotDone, DatabaseLookup: LookupMatched}
	if decision := services.DecideVerificationCase(input); !decision.Approve {
		t.Fatalf("clear Enhanced KYC result with independent account checks should approve: %v", decision.Reasons)
	}
	input.Result.DatabaseLookup = CheckReview
	if decision := services.DecideVerificationCase(input); decision.Approve || !slices.Contains(decision.Reasons, "government_lookup_not_matched") {
		t.Fatalf("unmatched NIN must not approve: %+v", decision)
	}
	input.Result.DatabaseLookup, input.Result.Deceased = LookupMatched, true
	if decision := services.DecideVerificationCase(input); decision.Approve || !slices.Contains(decision.Reasons, "id_authority_reports_deceased") {
		t.Fatalf("a record explicitly marked deceased must be routed to review: %+v", decision)
	}
}

func TestEnhancedDocumentVerificationDoesNotApproveDeceasedAuthorityRecord(t *testing.T) {
	input := cleanInput()
	input.Product = "enhanced_document_verification"
	input.Result.Deceased = true
	decision := services.DecideVerificationCase(input)
	if decision.Approve || !slices.Contains(decision.Reasons, "id_authority_reports_deceased") {
		t.Fatalf("an Enhanced Document Verification authority record marked deceased must be routed to review: %+v", decision)
	}
}

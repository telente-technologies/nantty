package services

const AutoApproveTrustScoreThreshold = 60

type AutoDecisionInput struct {
	Result               SmileVerificationResult
	NameMatchScore       float64
	TrustScore           int
	TrustBlocked         bool
	EligibleAtPayment    bool
	DocumentReusedByPeer bool
	GoldBusinessApproved bool
	IsGold               bool
}

type AutoDecision struct {
	Approve      bool
	Reasons      []string
	FraudSignals []string
}

func DecideVerificationCase(input AutoDecisionInput) AutoDecision {
	decision := AutoDecision{Reasons: []string{}, FraudSignals: []string{}}
	require := func(passed bool, reason string) {
		if !passed {
			decision.Reasons = append(decision.Reasons, reason)
		}
	}
	result := input.Result
	require(result.Liveness == CheckPassed, "liveness_not_passed")
	require(result.Document == CheckPassed, "document_not_valid")
	require(result.FaceMatch == CheckPassed, "face_match_not_passed")
	require(result.DatabaseLookup != CheckFailed && result.DatabaseLookup != CheckReview, "government_lookup_not_matched")
	require(input.NameMatchScore >= NameMatchAutoApproveThreshold, "name_does_not_match_profile")
	require(!input.TrustBlocked && input.TrustScore >= AutoApproveTrustScoreThreshold, "trust_score_below_threshold")
	require(input.EligibleAtPayment, "not_eligible_when_paid")
	require(!input.DocumentReusedByPeer, "document_used_by_another_account")
	if input.IsGold {
		require(input.GoldBusinessApproved, "business_documents_not_approved")
	}
	if result.SpoofSuspected {
		decision.FraudSignals = append(decision.FraudSignals, "spoof_attempt")
	}
	if input.DocumentReusedByPeer {
		decision.FraudSignals = append(decision.FraudSignals, "id_reused_across_accounts")
	}
	if result.Document == CheckPassed && input.NameMatchScore < NameMismatchFraudThreshold {
		decision.FraudSignals = append(decision.FraudSignals, "id_name_mismatch")
	}
	if result.DatabaseLookup == CheckFailed {
		decision.FraudSignals = append(decision.FraudSignals, "id_number_not_found")
	}
	decision.Approve = len(decision.Reasons) == 0
	return decision
}

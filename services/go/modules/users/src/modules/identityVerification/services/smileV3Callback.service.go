package services

import (
	"bytes"
	"encoding/json"
	"strings"
)

type smileV3CallbackBody struct {
	Status           string                     `json:"status"`
	Reason           string                     `json:"reason"`
	Product          string                     `json:"product"`
	PartnerArgs      map[string]json.RawMessage `json:"partner_params"`
	UserProvidedInfo struct {
		IDNumber string `json:"id_number"`
	} `json:"user_provided_info"`
	IDFields struct {
		FullName    string `json:"full_name"`
		IdNumber    string `json:"id_number"`
		Country     string `json:"country"`
		IdType      string `json:"id_type"`
		IsDeceased  bool   `json:"is_deceased"`
		DateOfDeath string `json:"date_of_death"`
	} `json:"id_fields"`
	Antifraud struct {
		FraudRisk struct {
			RiskLevel string `json:"risk_level"`
		} `json:"fraud_risk"`
		Summary struct {
			FraudDetected bool     `json:"fraud_detected"`
			FraudSources  []string `json:"fraud_sources"`
		} `json:"summary"`
		SmileSecure struct {
			Status string `json:"status"`
		} `json:"smile_secure"`
	} `json:"antifraud"`
}

func ParseSmileIdV3Callback(raw []byte, jobId, userId string) (SmileCallbackEnvelope, error) {
	var body smileV3CallbackBody
	if err := json.Unmarshal(raw, &body); err != nil || jobId == "" || userId == "" || body.Product == "" {
		return SmileCallbackEnvelope{}, ErrSmileCallbackMalformed
	}
	caseID, caseIDValid := smileOptionalPartnerParam(body.PartnerArgs, "nantty_case_id")
	captureAttemptID, captureAttemptIDValid := smileOptionalPartnerParam(body.PartnerArgs, "capture_attempt_id")
	if !caseIDValid || !captureAttemptIDValid {
		return SmileCallbackEnvelope{}, ErrSmileCallbackMalformed
	}
	switch body.Product {
	case "document_verification", "enhanced_document_verification", "enhanced_kyc":
	default:
		return SmileCallbackEnvelope{}, ErrSmileCallbackMalformed
	}
	status := strings.ToLower(strings.TrimSpace(body.Status))
	idNumber := body.IDFields.IdNumber
	if idNumber == "" && body.Product == "enhanced_kyc" && status == "clear" {
		idNumber = body.UserProvidedInfo.IDNumber
	}
	result := SmileVerificationResult{
		SmileJobId: truncateText(jobId, 120), ResultCode: truncateText(status, 20),
		DocumentType: strings.ToUpper(body.IDFields.IdType), DocumentCountry: strings.ToUpper(body.IDFields.Country),
		ProviderReasonCode: recognizedSmileReasonCode(body.Reason), ProviderReasonUnrecognized: strings.TrimSpace(body.Reason) != "" && recognizedSmileReasonCode(body.Reason) == "",
		FaceMatchConfidence: 0, Deceased: body.IDFields.IsDeceased || strings.TrimSpace(body.IDFields.DateOfDeath) != "",
		ProviderRiskFlagged: smileProviderRiskRequiresReview(body.Antifraud.FraudRisk.RiskLevel, body.Antifraud.Summary.FraudDetected, body.Antifraud.Summary.FraudSources, body.Antifraud.SmileSecure.Status),
	}
	switch status {
	case "clear":
		switch body.Product {
		case "enhanced_kyc":
			result.Liveness, result.Document, result.FaceMatch = CheckNotDone, CheckNotDone, CheckNotDone
			result.DatabaseLookup = LookupMatched
		case "document_verification":
			result.Liveness, result.Document, result.FaceMatch = CheckPassed, CheckPassed, CheckPassed
		case "enhanced_document_verification":
			result.Liveness, result.Document, result.FaceMatch = CheckPassed, CheckPassed, CheckPassed
			result.DatabaseLookup = LookupMatched
		}
	case "block":
		result.Liveness, result.Document, result.FaceMatch, result.DatabaseLookup = CheckReview, CheckFailed, CheckReview, CheckReview
	case "attention", "error":
		result.Liveness, result.Document, result.FaceMatch, result.DatabaseLookup = CheckReview, CheckReview, CheckReview, CheckReview
	default:
		return SmileCallbackEnvelope{}, ErrSmileCallbackMalformed
	}
	return SmileCallbackEnvelope{
		JobId: truncateText(jobId, 120), UserId: truncateText(userId, 120),
		CaseId: truncateText(caseID, 80), CaptureAttemptID: truncateText(captureAttemptID, 80), IsV3: true, Result: result,
		Product:  body.Product,
		idNumber: idNumber, FullName: body.IDFields.FullName,
	}, nil
}

func smileProviderRiskRequiresReview(riskLevel string, fraudDetected bool, fraudSources []string, secureStatus string) bool {
	riskLevel = strings.ToLower(strings.TrimSpace(riskLevel))
	secureStatus = strings.ToLower(strings.TrimSpace(secureStatus))
	return fraudDetected || len(fraudSources) > 0 ||
		(riskLevel != "" && riskLevel != "low") ||
		(secureStatus != "" && secureStatus != "clear")
}

func smileOptionalPartnerParam(params map[string]json.RawMessage, key string) (string, bool) {
	raw, ok := params[key]
	if !ok || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return "", true
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", false
	}
	return value, true
}

func recognizedSmileReasonCode(value string) string {
	code := strings.ToLower(strings.TrimSpace(value))
	switch code {
	case "document_expired", "age_requirement_not_met", "document_copy_detected", "medium_risk",
		"high_risk", "account_locked_fraud", "face_verification_failed", "spoof_detected", "document_check_failed",
		"unsupported_document", "identifier_not_found", "image_unavailable_or_invalid", "service_unavailable", "internal_error",
		"invalid_id_number", "document_unclassifiable", "content_policy_violated":
		return code
	default:
		return ""
	}
}

// Smile documents these product-specific error reasons as technical failures
// for which a fresh, user-initiated capture may be attempted.
func IsRetryableSmileProviderError(product, reason string) bool {
	reason = strings.ToLower(strings.TrimSpace(reason))
	switch product {
	case "document_verification":
		return reason == "internal_error" || reason == "image_unavailable_or_invalid" || reason == "document_unclassifiable"
	case "enhanced_document_verification":
		return reason == "internal_error" || reason == "service_unavailable" || reason == "image_unavailable_or_invalid" || reason == "document_unclassifiable"
	case "enhanced_kyc":
		return reason == "internal_error" || reason == "service_unavailable"
	default:
		return false
	}
}

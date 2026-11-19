package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

const (
	CheckPassed   = "passed"
	CheckFailed   = "failed"
	CheckReview   = "review"
	CheckNotDone  = "not_done"
	CheckPending  = "pending"
	LookupMatched = "matched"
)

var ErrSmileCallbackMalformed = errors.New("smile id callback is malformed")

const (
	smileCallbackMaximumAge = time.Hour
	smileCallbackFutureSkew = 5 * time.Minute
)

type smileCallbackBody struct {
	Signature       string            `json:"signature"`
	Timestamp       string            `json:"timestamp"`
	SmileJobId      string            `json:"SmileJobID"`
	ResultCode      string            `json:"ResultCode"`
	ResultText      string            `json:"ResultText"`
	Country         string            `json:"Country"`
	IdType          string            `json:"IDType"`
	IdNumber        string            `json:"IDNumber"`
	FullName        string            `json:"FullName"`
	ConfidenceValue json.RawMessage   `json:"ConfidenceValue"`
	Actions         map[string]string `json:"Actions"`
	PartnerParams   struct {
		JobId   string `json:"job_id"`
		UserId  string `json:"user_id"`
		JobType any    `json:"job_type"`
	} `json:"PartnerParams"`
}

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

type SmileCallbackEnvelope struct {
	Signature        string
	Timestamp        string
	JobId            string
	UserId           string
	CaseId           string
	CaptureAttemptID string
	IsV3             bool
	Product          string
	Result           SmileVerificationResult
	idNumber         string
	FullName         string
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

type SmileVerificationResult struct {
	SmileJobId                 string
	ResultCode                 string
	ProviderReasonCode         string
	ProviderReasonUnrecognized bool
	SelectedIdentityMismatch   bool
	DocumentType               string
	DocumentCountry            string
	Deceased                   bool
	Liveness                   string
	Document                   string
	FaceMatch                  string
	DatabaseLookup             string
	FaceMatchConfidence        float64
	SpoofSuspected             bool
	ProviderRiskFlagged        bool
}

func SmileResultMatchesSelection(result SmileVerificationResult, country, idType string) bool {
	resultCountry := strings.TrimSpace(result.DocumentCountry)
	resultType := strings.TrimSpace(result.DocumentType)
	return (resultCountry == "" || strings.EqualFold(resultCountry, strings.TrimSpace(country))) &&
		(resultType == "" || strings.EqualFold(resultType, strings.TrimSpace(idType)))
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

func ParseSmileIdCallback(raw []byte) (SmileCallbackEnvelope, error) {
	var body smileCallbackBody
	if err := json.Unmarshal(raw, &body); err != nil || body.PartnerParams.JobId == "" {
		return SmileCallbackEnvelope{}, ErrSmileCallbackMalformed
	}
	actions := body.Actions
	liveness := convertSmileActionToCheck(actions["Liveness_Check"])
	faceMatch := firstDecidedCheck(convertSmileActionToCheck(actions["Selfie_To_ID_Card_Compare"]), convertSmileActionToCheck(actions["Selfie_To_ID_Authority_Compare"]))
	result := SmileVerificationResult{
		SmileJobId: truncateText(body.SmileJobId, 80), ResultCode: truncateText(body.ResultCode, 10),
		DocumentType: strings.ToUpper(body.IdType), DocumentCountry: strings.ToUpper(body.Country),
		Liveness: liveness, Document: firstDecidedCheck(convertSmileActionToCheck(actions["Verify_Document"]), convertSmileActionToCheck(actions["Document_Check"])),
		FaceMatch: faceMatch, DatabaseLookup: convertSmileIdNumberLookup(actions["Verify_ID_Number"]),
		FaceMatchConfidence: parseConfidence(body.ConfidenceValue),
		SpoofSuspected:      liveness == CheckFailed || strings.Contains(strings.ToLower(body.ResultText), "spoof"),
	}
	return SmileCallbackEnvelope{Signature: body.Signature, Timestamp: body.Timestamp, JobId: body.PartnerParams.JobId, UserId: body.PartnerParams.UserId, Result: result, idNumber: body.IdNumber, FullName: body.FullName}, nil
}

func (envelope SmileCallbackEnvelope) IsFresh(now time.Time) bool {
	return SmileCallbackTimestampIsFresh(envelope.Timestamp, now)
}

func SmileCallbackTimestampIsFresh(timestamp string, now time.Time) bool {
	signedAt, err := time.Parse(time.RFC3339Nano, timestamp)
	return err == nil && !signedAt.Before(now.Add(-smileCallbackMaximumAge)) && !signedAt.After(now.Add(smileCallbackFutureSkew))
}

func (envelope SmileCallbackEnvelope) BelongsTo(accountId string) bool {
	return envelope.UserId != "" && strings.EqualFold(envelope.UserId, accountId)
}

func (envelope SmileCallbackEnvelope) DocumentFingerprint(key string) string {
	return envelope.DocumentFingerprintFor(key, envelope.Result.DocumentCountry, envelope.Result.DocumentType)
}

func (envelope SmileCallbackEnvelope) DocumentFingerprintFor(key, country, documentType string) string {
	number := strings.ToUpper(strings.Join(strings.Fields(envelope.idNumber), ""))
	country = strings.ToUpper(strings.TrimSpace(country))
	documentType = strings.ToUpper(strings.TrimSpace(documentType))
	if key == "" || number == "" || country == "" || documentType == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(country + "|" + documentType + "|" + number))
	return hex.EncodeToString(mac.Sum(nil))
}

func convertSmileActionToCheck(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "passed", "completed", "approved", "verified", "exact match":
		return CheckPassed
	case "failed", "rejected", "not verified":
		return CheckFailed
	case "under review", "partial match", "provisional approval", "unable to determine":
		return CheckReview
	case "":
		return CheckNotDone
	}
	return CheckNotDone
}

func convertSmileIdNumberLookup(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "verified", "exact match", "transliterated match":
		return LookupMatched
	case "not verified", "failed":
		return CheckFailed
	case "partial match", "issuer unavailable", "under review":
		return CheckReview
	}
	return CheckNotDone
}

func firstDecidedCheck(values ...string) string {
	for _, value := range values {
		if value != CheckNotDone {
			return value
		}
	}
	return CheckNotDone
}

func parseConfidence(raw json.RawMessage) float64 {
	text := strings.Trim(string(raw), `" `)
	value, err := strconv.ParseFloat(text, 64)
	if err != nil || value < 0 {
		return 0
	}
	if value > 1 {
		value /= 100
	}
	return min(value, 1)
}

func truncateText(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}

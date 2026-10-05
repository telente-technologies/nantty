package services

import (
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

type SmileCallbackEnvelope struct {
	Signature string
	Timestamp string
	JobId     string
	UserId    string
	Result    SmileVerificationResult
	idNumber  string
	FullName  string
}

type SmileVerificationResult struct {
	SmileJobId          string
	ResultCode          string
	DocumentType        string
	DocumentCountry     string
	Liveness            string
	Document            string
	FaceMatch           string
	DatabaseLookup      string
	FaceMatchConfidence float64
	SpoofSuspected      bool
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
		DocumentType: truncateText(strings.ToUpper(body.IdType), 40), DocumentCountry: truncateText(strings.ToUpper(body.Country), 2),
		Liveness: liveness, Document: firstDecidedCheck(convertSmileActionToCheck(actions["Verify_Document"]), convertSmileActionToCheck(actions["Document_Check"])),
		FaceMatch: faceMatch, DatabaseLookup: convertSmileIdNumberLookup(actions["Verify_ID_Number"]),
		FaceMatchConfidence: parseConfidence(body.ConfidenceValue),
		SpoofSuspected:      liveness == CheckFailed || strings.Contains(strings.ToLower(body.ResultText), "spoof"),
	}
	return SmileCallbackEnvelope{Signature: body.Signature, Timestamp: body.Timestamp, JobId: body.PartnerParams.JobId, UserId: body.PartnerParams.UserId, Result: result, idNumber: body.IdNumber, FullName: body.FullName}, nil
}

func (envelope SmileCallbackEnvelope) IsFresh(now time.Time) bool {
	signedAt, err := time.Parse(time.RFC3339Nano, envelope.Timestamp)
	return err == nil && !signedAt.Before(now.Add(-smileCallbackMaximumAge)) && !signedAt.After(now.Add(smileCallbackFutureSkew))
}

func (envelope SmileCallbackEnvelope) BelongsTo(accountId string) bool {
	return envelope.UserId == "" || strings.EqualFold(envelope.UserId, accountId)
}

func (envelope SmileCallbackEnvelope) DocumentFingerprint(key string) string {
	number := strings.ToUpper(strings.Join(strings.Fields(envelope.idNumber), ""))
	if key == "" || number == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(envelope.Result.DocumentCountry + "|" + envelope.Result.DocumentType + "|" + number))
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

package validators

import (
	"net/http"
	"net/url"
	"strings"

	"nantty/platform/httpserver"
)

const (
	MaximumProofItems    = 10
	MaximumSegments      = 20
	MaximumSegmentSecond = 6 * 60 * 60
)

type Segment struct {
	StartSeconds float64 `json:"startSeconds"`
	EndSeconds   float64 `json:"endSeconds"`
}

type ClaimEvidence struct {
	TargetType          string
	ClaimScope          string
	ClaimantName        string
	OriginalWorkUrl     string
	OriginalWorkMediaId string
	ProofUrls           []string
	ProofMediaIds       []string
	Segments            []Segment
	AccuracyDeclared    bool
	SignatureName       string
}

func invalid(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func IsHttpUrl(candidate string) bool {
	if len(candidate) > 2048 {
		return false
	}
	parsed, err := url.Parse(candidate)
	return err == nil && (parsed.Scheme == "https" || parsed.Scheme == "http") && parsed.Host != ""
}

func ScopeFor(targetType, declared string) string {
	if declared == "audio" || declared == "video" {
		return declared
	}
	if targetType == "sound" {
		return "audio"
	}
	return "video"
}

func ValidateClaimEvidence(evidence ClaimEvidence) error {
	name, signature := strings.TrimSpace(evidence.ClaimantName), strings.TrimSpace(evidence.SignatureName)
	switch {
	case evidence.ClaimScope != "" && evidence.ClaimScope != "audio" && evidence.ClaimScope != "video":
		return invalid("claimScope", "must be audio or video")
	case len(name) < 2 || len(name) > 120:
		return invalid("claimantName", "your full legal name is required")
	case evidence.OriginalWorkUrl == "" && evidence.OriginalWorkMediaId == "":
		return invalid("originalWorkUrl", "link to or upload the original work")
	case evidence.OriginalWorkUrl != "" && !IsHttpUrl(evidence.OriginalWorkUrl):
		return invalid("originalWorkUrl", "must be a valid http(s) link")
	case len(evidence.ProofUrls)+len(evidence.ProofMediaIds) == 0:
		return invalid("proofUrls", "add at least one proof-of-ownership document or link")
	case len(evidence.ProofUrls) > MaximumProofItems || len(evidence.ProofMediaIds) > MaximumProofItems:
		return invalid("proofUrls", "at most 10 links and 10 documents")
	case !evidence.AccuracyDeclared:
		return httpserver.NewApiError(http.StatusUnprocessableEntity, "ACCURACY_DECLARATION_REQUIRED", "The accuracy declaration is required")
	case len(signature) < 2 || len(signature) > 160:
		return httpserver.NewApiError(http.StatusUnprocessableEntity, "SIGNATURE_REQUIRED", "Type your full name as your electronic signature")
	case !strings.EqualFold(signature, name):
		return invalid("signatureName", "your signature must match your full legal name")
	}
	for _, link := range evidence.ProofUrls {
		if !IsHttpUrl(link) {
			return invalid("proofUrls", "every proof link must be a valid http(s) link")
		}
	}
	for _, mediaId := range append([]string{evidence.OriginalWorkMediaId}, evidence.ProofMediaIds...) {
		if len(mediaId) > 64 {
			return invalid("proofMediaIds", "unknown upload")
		}
	}
	return validateSegments(evidence.TargetType, evidence.Segments)
}

func validateSegments(targetType string, segments []Segment) error {
	if len(segments) == 0 && targetType != "sound" {
		return invalid("segments", "add the timestamps of the infringing part")
	}
	if len(segments) > MaximumSegments {
		return invalid("segments", "at most 20 segments")
	}
	for _, segment := range segments {
		if segment.StartSeconds < 0 || segment.EndSeconds <= segment.StartSeconds || segment.EndSeconds > MaximumSegmentSecond {
			return invalid("segments", "each segment needs a start before its end")
		}
	}
	return nil
}

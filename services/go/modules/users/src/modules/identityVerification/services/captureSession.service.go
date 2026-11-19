package services

import (
	"encoding/base64"
	"strings"
	"time"

	"github.com/google/uuid"
)

const CaptureSessionLifetime = time.Hour

func CaptureAttemptMarker(caseID, attemptID string) string {
	caseUUID, caseErr := uuid.Parse(caseID)
	attemptUUID, attemptErr := uuid.Parse(attemptID)
	if caseErr == nil && attemptErr == nil {
		return "capture:v2:" + base64.RawURLEncoding.EncodeToString(caseUUID[:]) + ":" + base64.RawURLEncoding.EncodeToString(attemptUUID[:])
	}
	return "capture:" + caseID + ":" + attemptID + ":userbound"
}

func CaptureMarkerCanRetry(status string, marker *string, consentAt *time.Time, now time.Time) bool {
	if status != "awaiting_consent" && status != "awaiting_capture" {
		return false
	}
	if marker == nil {
		return true
	}
	if *marker == "" {
		return true
	}
	_, legacyUUIDMarkerErr := uuid.Parse(*marker)
	if (!strings.HasPrefix(*marker, "capture:") && legacyUUIDMarkerErr != nil) || consentAt == nil {
		return false
	}
	return !now.Before(consentAt.Add(CaptureSessionLifetime))
}

func CaptureAttemptMatches(marker *string, caseID, callbackAttemptID string) bool {
	if marker == nil {
		return false
	}
	if markerCaseID, markerAttemptID, ok := parseCaptureAttemptMarkerV2(*marker); ok {
		caseUUID, caseErr := uuid.Parse(caseID)
		attemptUUID, attemptErr := uuid.Parse(callbackAttemptID)
		return caseErr == nil && attemptErr == nil && markerCaseID == caseUUID && markerAttemptID == attemptUUID
	}
	legacyMarker := "capture:" + caseID
	if *marker == legacyMarker {
		return callbackAttemptID == ""
	}
	markerPrefix := legacyMarker + ":"
	if !strings.HasPrefix(*marker, markerPrefix) {
		return false
	}
	markerAttemptID := strings.TrimPrefix(*marker, markerPrefix)
	markerAttemptID = strings.TrimSuffix(markerAttemptID, ":userbound")
	return markerAttemptID != "" && callbackAttemptID == markerAttemptID
}

func CaptureAttemptRequiresSmileUserBinding(marker *string, caseID string) bool {
	if marker == nil {
		return false
	}
	if markerCaseID, _, ok := parseCaptureAttemptMarkerV2(*marker); ok {
		caseUUID, err := uuid.Parse(caseID)
		return err == nil && markerCaseID == caseUUID
	}
	return strings.HasPrefix(*marker, "capture:"+caseID+":") && strings.HasSuffix(*marker, ":userbound")
}

func CaptureAttemptIDFromSmileUserID(userID string) (string, bool) {
	const prefix = "nantty-capture-"
	if !strings.HasPrefix(userID, prefix) {
		return "", false
	}
	attemptID, err := uuid.Parse(strings.TrimPrefix(userID, prefix))
	if err != nil || attemptID == uuid.Nil || attemptID.String() != strings.TrimPrefix(userID, prefix) {
		return "", false
	}
	return attemptID.String(), true
}

func CaptureAttemptCallbackMatches(marker *string, caseID, callbackAttemptID, userID string, storedSmileUserID *string) bool {
	if storedSmileUserID != nil && userID != *storedSmileUserID {
		return false
	}
	attemptID := callbackAttemptID
	if CaptureAttemptRequiresSmileUserBinding(marker, caseID) {
		if attemptID == "" {
			var ok bool
			attemptID, ok = CaptureAttemptIDFromSmileUserID(userID)
			if !ok {
				return false
			}
		}
		if userID != "nantty-capture-"+attemptID {
			return false
		}
	}
	return CaptureAttemptMatches(marker, caseID, attemptID)
}

func parseCaptureAttemptMarkerV2(marker string) (uuid.UUID, uuid.UUID, bool) {
	if !strings.HasPrefix(marker, "capture:v2:") {
		return uuid.Nil, uuid.Nil, false
	}
	parts := strings.Split(strings.TrimPrefix(marker, "capture:v2:"), ":")
	if len(parts) != 2 {
		return uuid.Nil, uuid.Nil, false
	}
	caseBytes, caseErr := base64.RawURLEncoding.DecodeString(parts[0])
	attemptBytes, attemptErr := base64.RawURLEncoding.DecodeString(parts[1])
	if caseErr != nil || attemptErr != nil || len(caseBytes) != 16 || len(attemptBytes) != 16 {
		return uuid.Nil, uuid.Nil, false
	}
	caseUUID, attemptUUID := uuid.UUID(caseBytes), uuid.UUID(attemptBytes)
	return caseUUID, attemptUUID, true
}

func CaptureAttemptIDForReplay(marker *string, caseID uuid.UUID) (uuid.UUID, bool) {
	if marker == nil || caseID == uuid.Nil {
		return uuid.Nil, false
	}
	if markerCaseID, attemptID, ok := parseCaptureAttemptMarkerV2(*marker); ok {
		return attemptID, markerCaseID == caseID
	}
	prefix := "capture:" + caseID.String() + ":"
	if !strings.HasPrefix(*marker, prefix) || !strings.HasSuffix(*marker, ":userbound") {
		return uuid.Nil, false
	}
	attemptValue := strings.TrimSuffix(strings.TrimPrefix(*marker, prefix), ":userbound")
	attemptID, err := uuid.Parse(attemptValue)
	return attemptID, err == nil && attemptID != uuid.Nil
}

func CaptureAttemptSmileUserMatches(marker *string, caseID, userID, expectedUserID string) bool {
	if !CaptureAttemptRequiresSmileUserBinding(marker, caseID) {
		return true
	}
	return expectedUserID != "" && userID == expectedUserID
}

func WebPhotoDocumentCaptureCanCancel(status, product string, marker *string, caseID, attemptID string) bool {
	photoDocumentProduct := product == "document_verification" || product == "enhanced_document_verification"
	return status == "awaiting_capture" && photoDocumentProduct && CaptureAttemptMatches(marker, caseID, attemptID)
}

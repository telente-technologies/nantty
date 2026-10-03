package validators

import (
	"regexp"

	"zudomart/modules/ads/src/modules/decision/dtos"
	"zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

var identifierPattern = regexp.MustCompile(`^[A-Za-z0-9_\-:.]{1,128}$`)

func ValidateSlot(slot dtos.SlotRequest, sessionId string) error {
	var issues []httpserver.ValidationIssue
	if _, known := services.PlacementForSlotKind(slot.Kind); !known {
		issues = append(issues, httpserver.ValidationIssue{Path: "slot.kind", Message: "is not a known slot kind"})
	}
	if sessionId == "" || !identifierPattern.MatchString(sessionId) {
		issues = append(issues, httpserver.ValidationIssue{Path: "sessionId", Message: "is required"})
	}
	if slot.ContentId != "" && !identifierPattern.MatchString(slot.ContentId) {
		issues = append(issues, httpserver.ValidationIssue{Path: "slot.contentId", Message: "is not a valid id"})
	}
	if services.IsContentAdjacentSlot(slot.Kind) && slot.ContentId == "" {
		issues = append(issues, httpserver.ValidationIssue{Path: "slot.contentId", Message: "is required for pre-roll and post-roll"})
	}
	if len(slot.NeighbourContentIds) > 10 {
		issues = append(issues, httpserver.ValidationIssue{Path: "slot.neighbourContentIds", Message: "allows at most 10 ids"})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func ValidateInternal(request dtos.InternalDecideRequest) error {
	if !identifierPattern.MatchString(request.UserId) {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "userId", Message: "is required"}})
	}
	return ValidateSlot(request.Slot, request.SessionId)
}

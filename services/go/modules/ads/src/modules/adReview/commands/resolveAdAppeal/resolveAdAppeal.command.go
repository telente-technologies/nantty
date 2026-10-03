package resolveadappeal

import (
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/adReview/dtos"
	"zudomart/modules/ads/src/modules/adReview/services"
	"zudomart/platform/httpserver"
)

type Command struct {
	AdId     uuid.UUID
	Reviewer services.Reviewer
	Request  dtos.ResolveAppealRequest
}

func Validate(request dtos.ResolveAppealRequest) error {
	if request.Decision != "uphold" && request.Decision != "overturn" {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "decision", Message: "Choose uphold or overturn."}})
	}
	if len(strings.TrimSpace(request.Note)) < 5 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "note", Message: "Add a short resolution note."}})
	}
	return nil
}

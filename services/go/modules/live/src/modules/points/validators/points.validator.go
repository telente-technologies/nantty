package validators

import (
	"slices"

	"zudomart/modules/live/src/modules/points/dtos"
	"zudomart/platform/httpserver"
)

func ValidateEngagementRequest(body dtos.EngagementRequest) error {
	if !slices.Contains([]string{"like", "share", "follow", "watch"}, body.Action) {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "action", Message: "must be like, share, follow or watch"}})
	}
	return nil
}

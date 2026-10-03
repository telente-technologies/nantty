package updateadaccount

import (
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	"zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/platform/httpserver"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Request   dtos.UpdateAdAccountRequest
}

func Validate(request dtos.UpdateAdAccountRequest) error {
	var issues []httpserver.ValidationIssue
	if request.Name != nil {
		if name := strings.TrimSpace(*request.Name); name == "" || len(name) > 120 {
			issues = append(issues, httpserver.ValidationIssue{Path: "name", Message: "Enter a name up to 120 characters."})
		}
	}
	if request.Timezone != nil && !services.IsKnownTimezone(*request.Timezone) {
		issues = append(issues, httpserver.ValidationIssue{Path: "timezone", Message: "Choose a valid time zone."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

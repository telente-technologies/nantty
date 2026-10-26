package createadaccount

import (
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/adAccounts/dtos"
	"nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/platform/httpserver"
)

type Command struct {
	UserId  uuid.UUID
	Request dtos.CreateAdAccountRequest
}

func Validate(request dtos.CreateAdAccountRequest) error {
	var issues []httpserver.ValidationIssue
	if name := strings.TrimSpace(request.Name); name == "" || len(name) > 120 {
		issues = append(issues, httpserver.ValidationIssue{Path: "name", Message: "Enter a name up to 120 characters."})
	}
	if request.Kind != "personal" && request.Kind != "business" {
		issues = append(issues, httpserver.ValidationIssue{Path: "kind", Message: "Choose personal or business."})
	}
	if len(request.CountryCode) != 2 {
		issues = append(issues, httpserver.ValidationIssue{Path: "countryCode", Message: "Use a two-letter country code."})
	}
	if !services.IsKnownTimezone(request.Timezone) {
		issues = append(issues, httpserver.ValidationIssue{Path: "timezone", Message: "Choose a valid time zone."})
	}
	if request.Kind == "business" && (request.StoreId == nil || *request.StoreId == "") {
		issues = append(issues, httpserver.ValidationIssue{Path: "storeId", Message: "Choose the store this account advertises."})
	}
	if request.Kind == "personal" && request.StoreId != nil && *request.StoreId != "" {
		issues = append(issues, httpserver.ValidationIssue{Path: "storeId", Message: "Personal accounts cannot link a store."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

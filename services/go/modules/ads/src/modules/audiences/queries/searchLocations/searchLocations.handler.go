package searchlocations

import (
	"strings"

	"nantty/modules/ads/src/modules/audiences/services"
	"nantty/modules/ads/src/types"
	"nantty/platform/httpserver"
)

const maximumResults = 25

type Handler struct{}

func (Handler) Execute(query Query) ([]types.LocationTarget, error) {
	search := strings.ToLower(strings.TrimSpace(query.Search))
	countryCode := strings.ToUpper(strings.TrimSpace(query.CountryCode))
	if len(search) > 80 || (countryCode != "" && len(countryCode) != 2) {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "search", Message: "Use up to 80 characters and a two-letter country code."}})
	}
	matches := make([]types.LocationTarget, 0, maximumResults)
	for _, location := range services.Locations {
		if countryCode != "" && location.CountryCode != countryCode {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(location.Name+" "+parentOf(location)+" "+location.Code), search) {
			continue
		}
		matches = append(matches, location)
		if len(matches) == maximumResults {
			break
		}
	}
	return matches, nil
}

func parentOf(location types.LocationTarget) string {
	if location.ParentName == nil {
		return ""
	}
	return *location.ParentName
}

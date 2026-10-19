package services

import (
	"strings"

	audienceservices "zudomart/modules/ads/src/modules/audiences/services"
	"zudomart/modules/ads/src/types"
)

func StateTargetFor(countryCode, requested string) types.LocationTarget {
	wanted := strings.TrimSpace(requested)
	for _, location := range audienceservices.Locations {
		if location.Type != "state" || location.CountryCode != countryCode {
			continue
		}
		if strings.EqualFold(location.Code, wanted) || strings.EqualFold(location.Name, wanted) {
			return location
		}
	}
	return types.LocationTarget{Type: "state", Code: wanted, Name: wanted, CountryCode: countryCode}
}

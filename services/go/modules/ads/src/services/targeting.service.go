package services

import (
	"slices"
	"strconv"
	"strings"

	"nantty/modules/ads/src/types"
)

func MatchesTargeting(audience types.AudienceSpec, viewer types.Viewer, contentTopics []string) (bool, string) {
	for _, excluded := range audience.ExcludedLocations {
		if locationMatchesViewer(excluded, viewer) {
			return false, "excluded_location"
		}
	}
	if len(audience.Locations) > 0 && !slices.ContainsFunc(audience.Locations, func(location types.LocationTarget) bool { return locationMatchesViewer(location, viewer) }) {
		return false, "location"
	}
	if !viewer.PersonalizedAds {
		return matchesContextually(audience, contentTopics)
	}
	if !ageBandOverlaps(viewer.AgeBand, audience.AgeMin, audience.AgeMax) {
		return false, "age"
	}
	if audience.Gender != "" && audience.Gender != "all" && audience.Gender != viewer.Gender {
		return false, "gender"
	}
	if len(audience.TopicIds) > 0 && !intersects(audience.TopicIds, slices.Concat(viewer.Topics, contentTopics)) {
		return false, "topics"
	}
	if len(audience.CustomAudienceIds) > 0 && !intersects(audience.CustomAudienceIds, viewer.CustomAudienceIds) {
		return false, "custom_audience"
	}
	if intersects(audience.ExcludedCustomAudienceIds, viewer.CustomAudienceIds) {
		return false, "excluded_custom_audience"
	}
	return true, ""
}

func matchesContextually(audience types.AudienceSpec, contentTopics []string) (bool, string) {
	narrowsPeople := audience.AgeMin > 18 || (audience.AgeMax != 0 && audience.AgeMax < 65) ||
		(audience.Gender != "" && audience.Gender != "all") || len(audience.BehaviourIds) > 0 || len(audience.CustomAudienceIds) > 0
	if narrowsPeople {
		return false, "requires_personalization"
	}
	if len(audience.TopicIds) > 0 && !intersects(audience.TopicIds, contentTopics) {
		return false, "contextual_topics"
	}
	return true, ""
}

func locationMatchesViewer(location types.LocationTarget, viewer types.Viewer) bool {
	switch location.Type {
	case "country":
		return strings.EqualFold(location.Code, viewer.Country)
	case "state":
		return viewer.Region != "" && (strings.EqualFold(location.Code, viewer.Region) || strings.EqualFold(location.Code, viewer.Country+"-"+viewer.Region))
	default:
		return strings.EqualFold(location.CountryCode, viewer.Country)
	}
}

func ageBandOverlaps(band string, targetMin, targetMax int) bool {
	if targetMin == 0 && targetMax == 0 {
		return true
	}
	lower, upper, known := parseAgeBand(band)
	if !known {
		return targetMin <= 18 && (targetMax == 0 || targetMax >= 65)
	}
	return lower <= max(targetMax, 65*boolToInt(targetMax == 0)) && upper >= targetMin
}

func parseAgeBand(band string) (int, int, bool) {
	if strings.HasSuffix(band, "+") {
		lower, err := strconv.Atoi(strings.TrimSuffix(band, "+"))
		return lower, 120, err == nil
	}
	low, high, found := strings.Cut(band, "-")
	lower, lowErr := strconv.Atoi(low)
	upper, highErr := strconv.Atoi(high)
	return lower, upper, found && lowErr == nil && highErr == nil
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func intersects(left, right []string) bool {
	return slices.ContainsFunc(left, func(item string) bool { return slices.Contains(right, item) })
}

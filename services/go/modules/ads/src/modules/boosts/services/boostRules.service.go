package services

import (
	"fmt"
	"slices"

	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/types"
)

var DurationDayOptions = []int{1, 3, 7, 14}

var BoostInterests = []string{"Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"}

var objectiveByGoal = map[string]string{"views": "awareness", "profile_visits": "traffic", "messages": "messages"}

var callToActionByGoal = map[string]string{"views": "watch_more", "profile_visits": "follow", "messages": "send_message"}

func ObjectiveForGoal(goal string) string { return objectiveByGoal[goal] }

func CallToActionForGoal(goal string) string { return callToActionByGoal[goal] }

func SuggestedDailyBudgets(minimumMinor int64, currency string) []types.Money {
	suggestions := make([]types.Money, 0, 4)
	for _, multiple := range []int64{1, 3, 7, 15} {
		suggestions = append(suggestions, types.Money{AmountMinor: minimumMinor * multiple, Currency: currency})
	}
	return suggestions
}

func EstimateBoost(request dtos.BoostEstimateRequest, reservePerMilleMinor int64) dtos.BoostEstimate {
	total := request.DailyBudget.AmountMinor * int64(request.DurationDays)
	impressions := total * 1_000 * 10 / (reservePerMilleMinor * 15)
	reach := impressions * 10 / 16
	if request.Audience.Mode == "custom" {
		reach = reach * 7 / 10
	}
	labels := map[string]string{
		"views":          fmt.Sprintf("About %d views", impressions),
		"profile_visits": fmt.Sprintf("About %d profile visits", max(reach*4/100, 1)),
		"messages":       fmt.Sprintf("About %d messages", max(reach*6/1000, 1)),
	}
	return dtos.BoostEstimate{
		EstimatedReachMin: reach * 8 / 10, EstimatedReachMax: reach * 125 / 100, EstimatedResultsLabel: labels[request.Goal],
		TotalCost: types.Money{AmountMinor: total, Currency: request.DailyBudget.Currency},
	}
}

func AudienceForBoost(audience dtos.BoostAudience, fallbackCountry string) types.AudienceSpec {
	spec := types.AudienceSpec{AgeMin: 18, AgeMax: 65, Gender: "all", Locations: []types.LocationTarget{{Type: "country", Code: fallbackCountry, Name: fallbackCountry, CountryCode: fallbackCountry}}}
	if audience.Mode != "custom" {
		return spec
	}
	country := audience.CountryCode
	spec.Locations = []types.LocationTarget{{Type: "country", Code: country, Name: country, CountryCode: country}}
	if len(audience.States) > 0 {
		spec.Locations = nil
		for _, state := range audience.States {
			spec.Locations = append(spec.Locations, types.LocationTarget{Type: "state", Code: state, Name: state, CountryCode: country})
		}
	}
	spec.AgeMin, spec.AgeMax = max(audience.AgeMin, 18), min(audience.AgeMax, 65)
	for _, interest := range audience.Interests {
		spec.TopicIds = append(spec.TopicIds, topicSlug(interest))
	}
	return spec
}

func topicSlug(interest string) string {
	slug := make([]rune, 0, len(interest))
	for _, character := range interest {
		switch {
		case character >= 'A' && character <= 'Z':
			slug = append(slug, character+32)
		case character >= 'a' && character <= 'z' || character >= '0' && character <= '9':
			slug = append(slug, character)
		case character == ' ' || character == '&':
			if len(slug) > 0 && slug[len(slug)-1] != '-' {
				slug = append(slug, '-')
			}
		}
	}
	return string(slug)
}

func IsSupportedGoal(goal string) bool {
	return slices.Contains([]string{"views", "profile_visits", "messages"}, goal)
}

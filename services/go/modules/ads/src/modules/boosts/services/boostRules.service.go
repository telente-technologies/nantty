package services

import (
	"fmt"
	"slices"

	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/modules/ads/src/types"
	"nantty/platform/regionpricing"
)

var DurationDayOptions = []int{1, 3, 7, 14}

const (
	MaximumDurationDays        = 30
	MaximumChangedDurationDays = 90
	MaximumScheduleDays        = 60
	BudgetTypeDaily            = "daily"
	BudgetTypeTotal            = "total"
)

var BoostInterests = []string{"Fashion", "Beauty", "Gadgets", "Food", "Home & Living", "Football", "Music", "Parenting", "Travel", "Tech"}

var objectiveByGoal = map[string]string{"views": "awareness", "profile_visits": "traffic", "messages": "messages", "store_visits": "traffic", "product_visits": "traffic"}

var callToActionByGoal = map[string]string{"views": "watch_more", "profile_visits": "follow", "messages": "send_message", "store_visits": "visit_store", "product_visits": "shop_now"}

func ObjectiveForGoal(goal string) string { return objectiveByGoal[goal] }

func BoostTargetCountries(audience dtos.BoostAudience) []string {
	if audience.Mode == "custom" && audience.CountryCode != "" {
		return []string{audience.CountryCode}
	}
	return nil
}

func CallToActionForGoal(goal string) string { return callToActionByGoal[goal] }

func SuggestedDailyBudgets(minimumMinor int64, currency string) []types.Money {
	suggestions := make([]types.Money, 0, 4)
	for _, multiple := range []int64{1, 3, 7, 15} {
		suggestions = append(suggestions, types.Money{AmountMinor: minimumMinor * multiple, Currency: currency})
	}
	return suggestions
}

var objectiveForBoostGoal = map[string]string{"views": "views", "profile_visits": "profile_visits", "messages": "messages", "store_visits": "profile_visits", "product_visits": "profile_visits"}

func EstimateRequestForBoost(request dtos.BoostEstimateRequest) regionpricing.EstimateRequest {
	estimate := regionpricing.EstimateRequest{
		Countries: BoostTargetCountries(request.Audience), BillingCurrency: request.DailyBudget.Currency, BudgetType: "daily",
		BudgetMinor: request.DailyBudget.AmountMinor, Days: request.DurationDays, Objective: objectiveForBoostGoal[request.Goal],
	}
	if request.BudgetType == BudgetTypeTotal && request.TotalBudget != nil {
		estimate.BudgetType, estimate.BudgetMinor = "lifetime", request.TotalBudget.AmountMinor
	}
	return estimate
}

func NormalizeBoostBudget(request dtos.BoostEstimateRequest) dtos.BoostEstimateRequest {
	if request.BudgetType == "" {
		request.BudgetType = BudgetTypeDaily
	}
	if request.BudgetType == BudgetTypeTotal && request.TotalBudget != nil && request.DurationDays > 0 {
		total := *request.TotalBudget
		request.DailyBudget = types.Money{AmountMinor: (total.AmountMinor + int64(request.DurationDays) - 1) / int64(request.DurationDays), Currency: total.Currency}
	}
	return request
}

func BoostTotalBudgetMinor(request dtos.BoostEstimateRequest) int64 {
	if request.BudgetType == BudgetTypeTotal && request.TotalBudget != nil {
		return request.TotalBudget.AmountMinor
	}
	return request.DailyBudget.AmountMinor * int64(max(request.DurationDays, 0))
}

func EstimateBoost(request dtos.BoostEstimateRequest, estimate regionpricing.CampaignEstimate) dtos.BoostEstimate {
	reach := estimate.Reach
	if request.Audience.Mode == "custom" {
		reach = regionpricing.Range{Low: reach.Low * 7 / 10, High: reach.High * 7 / 10}
	}
	labels := map[string]string{
		"views":          fmt.Sprintf("About %d–%d views", estimate.VideoViews.Low, estimate.VideoViews.High),
		"profile_visits": fmt.Sprintf("About %d–%d profile visits", estimate.Clicks.Low, estimate.Clicks.High),
		"store_visits":   fmt.Sprintf("About %d–%d store visits", estimate.Clicks.Low, estimate.Clicks.High),
		"product_visits": fmt.Sprintf("About %d–%d product views", estimate.Clicks.Low, estimate.Clicks.High),
		"messages":       fmt.Sprintf("About %d–%d messages", max(estimate.Results.Low, 1), max(estimate.Results.High, 1)),
	}
	region := ""
	if len(estimate.Regions) > 0 {
		region = estimate.Regions[0].Region
	}
	currency := request.DailyBudget.Currency
	return dtos.BoostEstimate{
		EstimatedReachMin: reach.Low, EstimatedReachMax: reach.High, EstimatedResultsLabel: labels[request.Goal],
		TotalCost: types.Money{AmountMinor: estimate.TotalCostMinor, Currency: currency}, Impressions: estimate.Impressions, Clicks: estimate.Clicks,
		CostPerResult: estimate.CostPerResult, MinimumDailyBudget: types.Money{AmountMinor: estimate.MinimumDailyBudgetMinor, Currency: currency}, Region: region,
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
			spec.Locations = append(spec.Locations, StateTargetFor(country, state))
		}
	}
	spec.AgeMin, spec.AgeMax = max(audience.AgeMin, 18), min(audience.AgeMax, 65)
	if audience.Gender == "female" || audience.Gender == "male" {
		spec.Gender = audience.Gender
	}
	for _, interest := range audience.Interests {
		spec.TopicIds = append(spec.TopicIds, topicSlug(interest))
	}
	for _, topicId := range audience.TopicIds {
		if !slices.Contains(spec.TopicIds, topicId) {
			spec.TopicIds = append(spec.TopicIds, topicId)
		}
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
	return slices.Contains([]string{"views", "profile_visits", "messages", "store_visits", "product_visits"}, goal)
}

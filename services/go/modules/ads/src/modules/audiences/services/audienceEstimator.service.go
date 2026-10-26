package services

import (
	"fmt"
	"slices"
	"time"

	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/types"
)

type EstimateInputs struct {
	Population           map[string]int64
	CustomAudienceSizes  map[string]int64
	ReservePerMilleMinor map[string]int64
	BaselineCtrPpm       int64
	Now                  time.Time
}

type objectiveModel struct {
	label         string
	perClick      float64
	usesReachOnly bool
}

var objectiveModels = map[string]objectiveModel{
	"awareness":       {label: "People reached", usesReachOnly: true},
	"traffic":         {label: "Link clicks", perClick: 1},
	"engagement":      {label: "Engagements", perClick: 2},
	"messages":        {label: "Conversations started", perClick: 0.1},
	"sales":           {label: "Purchases", perClick: 0.02},
	"followers":       {label: "New followers", perClick: 0.05},
	"store_promotion": {label: "Store visits", perClick: 0.6},
}

func IsKnownObjective(objective string) bool { _, known := objectiveModels[objective]; return known }

func locationShare(location types.LocationTarget) float64 {
	switch location.Type {
	case "state":
		return 0.08
	case "city":
		return 0.035
	}
	return 1
}

func locationAudience(locations []types.LocationTarget, population map[string]int64) float64 {
	total := 0.0
	for _, location := range locations {
		total += float64(population[location.CountryCode]) * locationShare(location)
	}
	return total
}

func ModelAudienceSize(spec types.AudienceSpec, inputs EstimateInputs) int64 {
	size := locationAudience(spec.Locations, inputs.Population) - locationAudience(spec.ExcludedLocations, inputs.Population)*0.9
	size *= 0.9 * float64(max(spec.AgeMax-spec.AgeMin+1, 1)) / 48
	if spec.Gender == "female" || spec.Gender == "male" {
		size *= 0.5
	}
	if len(spec.TopicIds) > 0 {
		size *= min(0.9, 0.3+0.1*float64(len(spec.TopicIds)))
	}
	for range spec.BehaviourIds {
		size *= 0.7
	}
	if len(spec.CustomAudienceIds) > 0 {
		var included int64
		for _, id := range spec.CustomAudienceIds {
			included += inputs.CustomAudienceSizes[id]
		}
		size = min(size, float64(included))
	}
	var excluded int64
	for _, id := range spec.ExcludedCustomAudienceIds {
		excluded += inputs.CustomAudienceSizes[id]
	}
	size -= min(size, float64(excluded)*0.9)
	return max(int64(size), 0)
}

func Breadth(size int64) string {
	switch {
	case size < 1_000:
		return "too_narrow"
	case size < 50_000:
		return "narrow"
	case size < 3_000_000:
		return "balanced"
	}
	return "broad"
}

func dailyBudgetMinor(budget *types.Budget, schedule types.Schedule) int64 {
	if budget == nil || budget.Amount.AmountMinor <= 0 {
		return 0
	}
	if budget.Type == "daily" {
		return budget.Amount.AmountMinor
	}
	start, startErr := time.Parse(time.RFC3339, schedule.StartAt)
	if schedule.EndAt == nil || startErr != nil {
		return 0
	}
	end, endErr := time.Parse(time.RFC3339, *schedule.EndAt)
	days := int64(end.Sub(start).Hours()/24) + 1
	if endErr != nil || days < 1 {
		return 0
	}
	return budget.Amount.AmountMinor / days
}

func Estimate(request dtos.EstimateRequest, inputs EstimateInputs) dtos.AudienceEstimate {
	model := objectiveModels[request.Objective]
	size := ModelAudienceSize(request.Audience, inputs)
	lower, upper := RoundToRange(size)
	estimate := dtos.AudienceEstimate{AudienceSize: dtos.NumberRange{Lower: lower, Upper: upper}, Breadth: Breadth(size), ResultLabel: model.label, Warnings: []string{}}
	if estimate.Breadth == "too_narrow" {
		estimate.Warnings = append(estimate.Warnings, "Your audience is very narrow. Widen the locations, ages or interests so your ads can deliver.")
	}
	if estimate.Breadth == "broad" {
		estimate.Warnings = append(estimate.Warnings, "Your audience is very broad. Narrowing it can make your budget go further.")
	}
	daily := dailyBudgetMinor(request.Budget, request.Schedule)
	reserve := inputs.ReservePerMilleMinor[budgetCurrency(request)]
	if daily == 0 || reserve == 0 {
		estimate.Warnings = append(estimate.Warnings, "Set a budget to see estimated daily reach and results.")
		return estimate
	}
	impressions := float64(daily) * 1000 / (1.5 * float64(reserve))
	coverage := min(1.0, 0.4+0.1*float64(len(request.Placements)))
	if len(request.Placements) == 0 {
		coverage = 1
	}
	reach := min(impressions*0.62*coverage, float64(size)*0.5)
	reachLow, reachHigh := RoundToRange(int64(reach))
	estimate.DailyReach = &dtos.NumberRange{Lower: reachLow, Upper: reachHigh}
	results := reach
	if !model.usesReachOnly {
		results = impressions * coverage * float64(inputs.BaselineCtrPpm) / 1_000_000 * model.perClick
	}
	resultLow, resultHigh := roundResults(int64(results))
	estimate.DailyResults = &dtos.NumberRange{Lower: resultLow, Upper: resultHigh}
	if reach < float64(size)*0.5 && impressions*0.62*coverage < float64(max(size/100, 1)) {
		estimate.Warnings = append(estimate.Warnings, fmt.Sprintf("Your budget is small for this audience. Increase it to reach more than about %d people a day.", reachHigh))
	}
	return estimate
}

func roundResults(exact int64) (lower, upper int64) {
	if exact < 10 {
		return 0, 10
	}
	return RoundToRange(exact)
}

func budgetCurrency(request dtos.EstimateRequest) string {
	if request.Budget != nil {
		return request.Budget.Amount.Currency
	}
	return ""
}

func PlacementsAreSupported(placements []string) bool {
	supported := []string{"feed", "clips", "mart", "search", "stories", "live"}
	for _, placement := range placements {
		if !slices.Contains(supported, placement) {
			return false
		}
	}
	return true
}

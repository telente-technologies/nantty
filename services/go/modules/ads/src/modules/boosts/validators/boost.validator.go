package validators

import (
	"slices"

	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/platform/httpserver"
)

func ValidateEstimate(request dtos.BoostEstimateRequest, minimumDailyMinor map[string]int64) error {
	var issues []httpserver.ValidationIssue
	if request.PostId == "" || len(request.PostId) > 80 {
		issues = append(issues, httpserver.ValidationIssue{Path: "postId", Message: "Choose a post to boost."})
	}
	if !services.IsSupportedGoal(request.Goal) {
		issues = append(issues, httpserver.ValidationIssue{Path: "goal", Message: "Choose views, profile_visits or messages."})
	}
	if !slices.Contains(services.DurationDayOptions, request.DurationDays) {
		issues = append(issues, httpserver.ValidationIssue{Path: "durationDays", Message: "Choose 1, 3, 7 or 14 days."})
	}
	minimum, known := minimumDailyMinor[request.DailyBudget.Currency]
	if !known {
		issues = append(issues, httpserver.ValidationIssue{Path: "dailyBudget.currency", Message: "This currency is not supported for boosts."})
	} else if request.DailyBudget.AmountMinor < minimum {
		issues = append(issues, httpserver.ValidationIssue{Path: "dailyBudget", Message: "Your daily budget is below the minimum."})
	}
	if request.Audience.Mode != "automatic" && request.Audience.Mode != "custom" {
		issues = append(issues, httpserver.ValidationIssue{Path: "audience.mode", Message: "Choose automatic or custom."})
	}
	if request.Audience.Mode == "custom" && (len(request.Audience.CountryCode) != 2 || request.Audience.AgeMin < 18 || request.Audience.AgeMax > 65 || request.Audience.AgeMin > request.Audience.AgeMax) {
		issues = append(issues, httpserver.ValidationIssue{Path: "audience", Message: "Use a two-letter country and ages 18-65."})
	}
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func ValidateCreate(request dtos.CreateBoostRequest, minimumDailyMinor map[string]int64) error {
	if err := ValidateEstimate(request.BoostEstimateRequest, minimumDailyMinor); err != nil {
		return err
	}
	if request.PaymentMethod != "wallet" && request.PaymentMethod != "card" {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "paymentMethod", Message: "Choose wallet or card."}})
	}
	return nil
}

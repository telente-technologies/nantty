package validators

import (
	"slices"
	"strings"
	"time"

	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

var createPaymentMethods = []string{"card", "balance", "free", "wallet", "ad_balance"}

func ValidateEstimate(request dtos.BoostEstimateRequest, minimumDailyMinor int64, now time.Time) error {
	var issues []httpserver.ValidationIssue
	issues = append(issues, destinationIssues(request)...)
	issues = append(issues, budgetIssues(request, minimumDailyMinor)...)
	issues = append(issues, audienceIssues(request.Audience)...)
	issues = append(issues, scheduleIssues(request.StartAt, now)...)
	if len(issues) > 0 {
		return httpserver.NewValidationFailedError(issues)
	}
	return nil
}

func budgetIssues(request dtos.BoostEstimateRequest, minimumDailyMinor int64) []httpserver.ValidationIssue {
	var issues []httpserver.ValidationIssue
	if request.DurationDays < 1 || request.DurationDays > services.MaximumDurationDays {
		issues = append(issues, httpserver.ValidationIssue{Path: "durationDays", Message: "Choose between 1 and 30 days."})
	}
	if !slices.Contains([]string{services.BudgetTypeDaily, services.BudgetTypeTotal}, request.BudgetType) {
		return append(issues, httpserver.ValidationIssue{Path: "budgetType", Message: "Choose a daily or a total budget."})
	}
	if !regionpricing.IsSupportedCurrency(request.DailyBudget.Currency) {
		return append(issues, httpserver.ValidationIssue{Path: "dailyBudget.currency", Message: "This currency is not supported for boosts."})
	}
	if request.BudgetType == services.BudgetTypeTotal {
		total := request.TotalBudget
		switch {
		case total == nil || total.Currency != request.DailyBudget.Currency:
			issues = append(issues, httpserver.ValidationIssue{Path: "totalBudget", Message: "Enter a total budget in the same currency."})
		case total.AmountMinor < minimumDailyMinor*int64(max(request.DurationDays, 1)):
			issues = append(issues, httpserver.ValidationIssue{Path: "totalBudget", Message: "Your total budget is below the minimum for this many days."})
		}
		return issues
	}
	if request.DailyBudget.AmountMinor < minimumDailyMinor {
		issues = append(issues, httpserver.ValidationIssue{Path: "dailyBudget", Message: "Your daily budget is below the minimum."})
	}
	return issues
}

func audienceIssues(audience dtos.BoostAudience) []httpserver.ValidationIssue {
	if audience.Mode != "automatic" && audience.Mode != "custom" {
		return []httpserver.ValidationIssue{{Path: "audience.mode", Message: "Choose automatic or custom."}}
	}
	if audience.Mode != "custom" {
		return nil
	}
	var issues []httpserver.ValidationIssue
	if len(audience.CountryCode) != 2 || audience.AgeMin < 18 || audience.AgeMax > 65 || audience.AgeMin > audience.AgeMax {
		issues = append(issues, httpserver.ValidationIssue{Path: "audience", Message: "Use a two-letter country and ages 18-65."})
	}
	if audience.Gender != "" && !slices.Contains([]string{"all", "female", "male"}, audience.Gender) {
		issues = append(issues, httpserver.ValidationIssue{Path: "audience.gender", Message: "Choose all, female or male."})
	}
	if len(audience.States) > 30 || len(audience.Interests) > 20 || len(audience.TopicIds) > 20 {
		issues = append(issues, httpserver.ValidationIssue{Path: "audience", Message: "Pick up to 30 places and 20 interests."})
	}
	for _, value := range slices.Concat(audience.States, audience.Interests, audience.TopicIds) {
		if strings.TrimSpace(value) == "" || len(value) > 80 {
			issues = append(issues, httpserver.ValidationIssue{Path: "audience", Message: "Places and interests must be 1-80 characters."})
			break
		}
	}
	return issues
}

func scheduleIssues(startAt *string, now time.Time) []httpserver.ValidationIssue {
	if startAt == nil || *startAt == "" {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, *startAt)
	if err != nil || parsed.Before(now.Add(-10*time.Minute)) || parsed.After(now.AddDate(0, 0, services.MaximumScheduleDays)) {
		return []httpserver.ValidationIssue{{Path: "startAt", Message: "Choose a start date from today up to 60 days ahead."}}
	}
	return nil
}

func destinationIssues(request dtos.BoostEstimateRequest) []httpserver.ValidationIssue {
	if !services.IsSupportedBoostDestination(request.DestinationType) {
		return []httpserver.ValidationIssue{{Path: "destinationType", Message: "Choose post, product, profile or store."}}
	}
	var issues []httpserver.ValidationIssue
	if request.TargetId == "" || len(request.TargetId) > 80 {
		path, message := "targetId", "Choose what to promote."
		if request.DestinationType == services.DestinationPost {
			path, message = "postId", "Choose a post to boost."
		}
		issues = append(issues, httpserver.ValidationIssue{Path: path, Message: message})
	}
	if !services.IsSupportedGoal(request.Goal) || !services.IsGoalAllowedForDestination(request.Goal, request.DestinationType) {
		issues = append(issues, httpserver.ValidationIssue{Path: "goal", Message: "Choose " + strings.Join(services.GoalsForDestination(request.DestinationType), ", ") + "."})
	}
	return issues
}

func ValidateCreate(request dtos.CreateBoostRequest, minimumDailyMinor int64, now time.Time) error {
	if err := ValidateEstimate(request.BoostEstimateRequest, minimumDailyMinor, now); err != nil {
		return err
	}
	if !slices.Contains(createPaymentMethods, request.PaymentMethod) {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "paymentMethod", Message: "Choose card, ad balance, earnings or free."}})
	}
	return nil
}

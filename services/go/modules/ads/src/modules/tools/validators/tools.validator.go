package validators

import (
	"fmt"
	"math"
	"slices"
	"strings"
	"time"

	"nantty/modules/ads/src/modules/tools/dtos"
	"nantty/platform/httpserver"
)

const minimumExperimentLength = 4 * 24 * time.Hour

var (
	conversionEventTypes = []string{"purchase", "add_to_cart", "checkout_started", "message_started", "profile_follow", "store_visit"}
	experimentVariables  = []string{"audience", "creative", "placement", "bid_strategy"}
	experimentMetrics    = []string{"cost_per_result", "ctr", "roas", "conversions"}
	ruleLevels           = []string{"campaign", "ad_set", "ad"}
	ruleMetrics          = []string{"cpc", "cpm", "ctr", "spend", "cost_per_result", "frequency", "roas", "impressions"}
	ruleOperators        = []string{"greater_than", "less_than"}
	ruleWindows          = []string{"today", "last_3_days", "last_7_days", "lifetime"}
	ruleActions          = []string{"pause", "notify", "increase_budget", "decrease_budget"}
	ruleIntervals        = []int{30, 60, 1440}
)

type issues []httpserver.ValidationIssue

func (list *issues) add(path, message string) {
	*list = append(*list, httpserver.ValidationIssue{Path: path, Message: message})
}

func (list issues) result() error {
	if len(list) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(list)
}

func validName(name string, limit int) bool {
	trimmed := strings.TrimSpace(name)
	return trimmed != "" && len(trimmed) <= limit
}

func ValidateConversionEventInput(input dtos.ConversionEventInput) error {
	var found issues
	if !validName(input.Name, 80) {
		found.add("name", "Name the event (up to 80 characters).")
	}
	if !slices.Contains(conversionEventTypes, input.EventType) {
		found.add("eventType", "Choose an event type.")
	}
	return found.result()
}

func ValidateConversionEventPatch(patch dtos.ConversionEventPatch) error {
	var found issues
	if patch.Name != nil && !validName(*patch.Name, 80) {
		found.add("name", "Name the event (up to 80 characters).")
	}
	if patch.Status != nil && *patch.Status != "active" && *patch.Status != "paused" {
		found.add("status", "Choose active or paused.")
	}
	return found.result()
}

func ValidateExperimentInput(input dtos.ExperimentInput) (time.Time, time.Time, error) {
	var found issues
	if !validName(input.Name, 100) {
		found.add("name", "Name the test (up to 100 characters).")
	}
	if !slices.Contains(experimentVariables, input.Variable) {
		found.add("variable", "Choose what to test.")
	}
	if !slices.Contains(experimentMetrics, input.Metric) {
		found.add("metric", "Choose how to pick the winner.")
	}
	if len(input.Arms) < 2 || len(input.Arms) > 5 {
		found.add("arms", "Choose two to five ad sets to compare.")
	}
	total, seen := 0, map[string]bool{}
	for index, arm := range input.Arms {
		if arm.TrafficPercent < 1 || arm.TrafficPercent > 99 {
			found.add(fmt.Sprintf("arms.%d.trafficPercent", index), "Give each side 1% to 99% of the traffic.")
		}
		if seen[arm.AdSetId] {
			found.add("arms", "Choose different ad sets for each side.")
		}
		seen[arm.AdSetId] = true
		total += arm.TrafficPercent
	}
	if len(input.Arms) >= 2 && total != 100 {
		found.add("arms", "Traffic split must add up to 100%.")
	}
	start, startErr := time.Parse(time.RFC3339, input.StartAt)
	end, endErr := time.Parse(time.RFC3339, input.EndAt)
	if startErr != nil {
		found.add("startAt", "Choose a start date.")
	}
	if endErr != nil || (startErr == nil && end.Sub(start) < minimumExperimentLength) {
		found.add("endAt", "Tests need to run for at least 4 days.")
	}
	return start, end, found.result()
}

func ValidateRuleInput(input dtos.AutomatedRuleInput) error {
	var found issues
	if !validName(input.Name, 100) {
		found.add("name", "Name the rule (up to 100 characters).")
	}
	if !slices.Contains(ruleLevels, input.Level) {
		found.add("level", "Choose campaigns, ad sets or ads.")
	}
	if len(input.TargetIds) == 0 || len(input.TargetIds) > 100 {
		found.add("targetIds", "Choose 1 to 100 items for this rule.")
	}
	if len(input.Conditions) == 0 || len(input.Conditions) > 5 {
		found.add("conditions", "Add one to five conditions.")
	}
	for index, condition := range input.Conditions {
		path := fmt.Sprintf("conditions.%d.", index)
		if !slices.Contains(ruleMetrics, condition.Metric) {
			found.add(path+"metric", "Choose a metric.")
		}
		if !slices.Contains(ruleOperators, condition.Operator) {
			found.add(path+"operator", "Choose greater than or less than.")
		}
		if condition.Value < 0 || math.IsNaN(condition.Value) || math.IsInf(condition.Value, 0) {
			found.add(path+"value", "Enter a number.")
		}
		if !slices.Contains(ruleWindows, condition.Window) {
			found.add(path+"window", "Choose a time window.")
		}
	}
	validateRuleAction(input, &found)
	if !slices.Contains(ruleIntervals, input.CheckEveryMinutes) {
		found.add("checkEveryMinutes", "Check every 30 minutes, hour or day.")
	}
	return found.result()
}

func validateRuleAction(input dtos.AutomatedRuleInput, found *issues) {
	action := input.Action
	if !slices.Contains(ruleActions, action.Type) {
		found.add("action.type", "Choose an action.")
		return
	}
	changesBudget := action.Type == "increase_budget" || action.Type == "decrease_budget"
	if changesBudget && (action.Percent == nil || *action.Percent < 1 || *action.Percent > 100) {
		found.add("action.percent", "Choose 1% to 100%.")
	}
	if !changesBudget && action.Percent != nil {
		found.add("action.percent", "Only budget changes take a percentage.")
	}
	if changesBudget && input.Level == "ad" {
		found.add("action.type", "Budgets can only change on campaigns or ad sets.")
	}
}

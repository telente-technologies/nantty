package loaders

import "zudomart/modules/subscriptions/src/models"

type combinedGoldSettings struct {
	MultiBusinessSingleProfilePercent *int    `json:"multiBusinessSingleProfilePercent"`
	MultiBusinessBasePercent          *int    `json:"multiBusinessBasePercent"`
	MultiBusinessStepPercent          *int    `json:"multiBusinessStepPercent"`
	MultiBusinessMaximumProfiles      *int    `json:"multiBusinessMaximumProfiles"`
	MultiBusinessYearlyExtraPercent   *int    `json:"multiBusinessYearlyExtraPercent"`
	MultiBusinessYearlyMode           *string `json:"multiBusinessYearlyMode"`
}

func percentToBps(value *int, fallback int64) int64 {
	if value == nil || *value < 0 || *value > 90 {
		return fallback
	}
	return int64(*value) * 100
}

func (settings combinedGoldSettings) applyTo(rules models.CombinedGoldRules) models.CombinedGoldRules {
	rules.SingleProfileBps = percentToBps(settings.MultiBusinessSingleProfilePercent, rules.SingleProfileBps)
	rules.BaseBps = percentToBps(settings.MultiBusinessBasePercent, rules.BaseBps)
	rules.StepBps = percentToBps(settings.MultiBusinessStepPercent, rules.StepBps)
	rules.YearlyExtraBps = percentToBps(settings.MultiBusinessYearlyExtraPercent, rules.YearlyExtraBps)
	if value := settings.MultiBusinessMaximumProfiles; value != nil && *value >= 1 && *value <= 5 {
		rules.MaximumProfiles = *value
	}
	if value := settings.MultiBusinessYearlyMode; value != nil && (*value == models.CombinedGoldYearlyReplacesStandard || *value == models.CombinedGoldYearlyAddsToStandard) {
		rules.YearlyMode = *value
	}
	return rules
}

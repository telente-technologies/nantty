package services

import adminerrors "zudomart/modules/admin/src/errors"

type MultiBusinessRules struct {
	MultiBusinessSingleProfilePercent *int    `json:"multiBusinessSingleProfilePercent,omitempty"`
	MultiBusinessBasePercent          *int    `json:"multiBusinessBasePercent,omitempty"`
	MultiBusinessStepPercent          *int    `json:"multiBusinessStepPercent,omitempty"`
	MultiBusinessMaximumProfiles      *int    `json:"multiBusinessMaximumProfiles,omitempty"`
	MultiBusinessYearlyExtraPercent   *int    `json:"multiBusinessYearlyExtraPercent,omitempty"`
	MultiBusinessYearlyMode           *string `json:"multiBusinessYearlyMode,omitempty"`
}

func defaultMultiBusinessRules() MultiBusinessRules {
	value := func(number int) *int { return &number }
	mode := "replace"
	return MultiBusinessRules{
		MultiBusinessSingleProfilePercent: value(5), MultiBusinessBasePercent: value(10), MultiBusinessStepPercent: value(2), MultiBusinessMaximumProfiles: value(5),
		MultiBusinessYearlyExtraPercent: value(5), MultiBusinessYearlyMode: &mode,
	}
}

func validateMultiBusinessRules(rules MultiBusinessRules) error {
	for name, value := range map[string]*int{
		"multiBusinessSingleProfilePercent": rules.MultiBusinessSingleProfilePercent, "multiBusinessBasePercent": rules.MultiBusinessBasePercent,
		"multiBusinessStepPercent": rules.MultiBusinessStepPercent, "multiBusinessYearlyExtraPercent": rules.MultiBusinessYearlyExtraPercent,
	} {
		if value != nil {
			if err := requireWithin(name, *value, 0, 90); err != nil {
				return err
			}
		}
	}
	if value := rules.MultiBusinessMaximumProfiles; value != nil {
		if err := requireWithin("multiBusinessMaximumProfiles", *value, 1, 5); err != nil {
			return err
		}
	}
	if mode := rules.MultiBusinessYearlyMode; mode != nil && *mode != "replace" && *mode != "add" {
		return adminerrors.Unprocessable("multiBusinessYearlyMode must be replace or add.")
	}
	base, step, maximum := 10, 2, 5
	if rules.MultiBusinessBasePercent != nil {
		base = *rules.MultiBusinessBasePercent
	}
	if rules.MultiBusinessStepPercent != nil {
		step = *rules.MultiBusinessStepPercent
	}
	if rules.MultiBusinessMaximumProfiles != nil {
		maximum = *rules.MultiBusinessMaximumProfiles
	}
	if base+step*max(maximum-2, 0) > 90 {
		return adminerrors.Unprocessable("The multi-business discount can't go above 90% at the maximum number of profiles.")
	}
	return nil
}

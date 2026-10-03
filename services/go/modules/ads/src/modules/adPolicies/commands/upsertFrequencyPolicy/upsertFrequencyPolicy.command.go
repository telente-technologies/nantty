package upsertfrequencypolicy

import (
	"zudomart/modules/ads/src/modules/adPolicies/dtos"
	"zudomart/platform/httpserver"
)

type Command struct{ Policy dtos.FrequencyPolicy }

func (command Command) Validate() error {
	policy := command.Policy
	for _, value := range []int{policy.SessionCap, policy.HourCap, policy.DayCap, policy.AdvertiserDayCap, policy.MinGapSlots, policy.CooldownSecondsAfterSkip} {
		if value < 0 || value > 10_000 {
			return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "body", Message: "caps must be between 0 and 10000 (0 means no cap)"}})
		}
	}
	if policy.Format == "" || len(policy.Format) > 20 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "format", Message: "is required"}})
	}
	return nil
}

package saverule

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/modules/tools/dtos"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	RuleId    string
	Create    *dtos.AutomatedRuleInput
	Patch     *dtos.AutomatedRulePatch
}

func merge(current dtos.AutomatedRuleInput, patch dtos.AutomatedRulePatch) dtos.AutomatedRuleInput {
	if patch.Name != nil {
		current.Name = *patch.Name
	}
	if patch.Level != nil {
		current.Level = *patch.Level
	}
	if patch.TargetIds != nil {
		current.TargetIds = *patch.TargetIds
	}
	if patch.Conditions != nil {
		current.Conditions = *patch.Conditions
	}
	if patch.Action != nil {
		current.Action = *patch.Action
	}
	if patch.CheckEveryMinutes != nil {
		current.CheckEveryMinutes = *patch.CheckEveryMinutes
	}
	return current
}

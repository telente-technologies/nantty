package loaders

import (
	"context"
	"encoding/json"

	ledgerloaders "zudomart/modules/ledger/src/loaders"
	"zudomart/modules/subscriptions/src/constants"
)

const FullAdLoadPercent = 100

type AdLoadTable struct {
	FreePercent   int
	PercentByPlan map[string]int
}

func DefaultAdLoadTable() AdLoadTable {
	return AdLoadTable{FreePercent: FullAdLoadPercent, PercentByPlan: map[string]int{
		constants.PlanBlueEssential: 75, constants.PlanBlue: 60, constants.PlanPremium: 0,
		constants.PlanGoldOnly: 50, constants.PlanSellerPro: 50, constants.PlanSellerBusiness: 0,
		constants.PlanBlack: 20,
	}}
}

func IsAdFreePlan(planCode string) bool {
	return planCode == constants.PlanPremium || planCode == constants.PlanSellerBusiness
}

func clampAdLoadPercent(planCode string, percent int) int {
	if IsAdFreePlan(planCode) {
		return 0
	}
	return min(max(percent, 0), FullAdLoadPercent)
}

func ReadAdLoadTable(ctx context.Context, source *ledgerloaders.PlatformSettingsSource) AdLoadTable {
	table := DefaultAdLoadTable()
	if source == nil {
		return table
	}
	raw, found := source.ReadValue(ctx, PlansSettingKey)
	if !found {
		return table
	}
	var stored struct {
		FreeAdLoadPercent *int `json:"freeAdLoadPercent"`
		Plans             []struct {
			PlanKey       string `json:"planKey"`
			AdLoadPercent *int   `json:"adLoadPercent"`
		} `json:"plans"`
	}
	if json.Unmarshal(raw, &stored) != nil {
		return table
	}
	if stored.FreeAdLoadPercent != nil {
		table.FreePercent = min(max(*stored.FreeAdLoadPercent, 0), FullAdLoadPercent)
	}
	for _, plan := range stored.Plans {
		code, known := planCodeForKey(plan.PlanKey)
		if known && plan.AdLoadPercent != nil {
			table.PercentByPlan[code] = clampAdLoadPercent(code, *plan.AdLoadPercent)
		}
	}
	return table
}

func (table AdLoadTable) PercentFor(livePlanCodes []string) int {
	percent := table.FreePercent
	for _, code := range livePlanCodes {
		planPercent, known := table.PercentByPlan[code]
		if !known {
			continue
		}
		percent = min(percent, clampAdLoadPercent(code, planPercent))
	}
	return percent
}

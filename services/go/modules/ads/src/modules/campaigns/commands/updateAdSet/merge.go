package updateadset

import (
	"time"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
)

func merge(current dtos.AdSetInput, patch dtos.AdSetPatch) dtos.AdSetInput {
	if patch.Name != nil {
		current.Name = *patch.Name
	}
	if patch.Audience != nil {
		current.Audience = *patch.Audience
	}
	if patch.PlacementMode != nil {
		current.PlacementMode = *patch.PlacementMode
	}
	if patch.Placements != nil {
		current.Placements = *patch.Placements
	}
	if patch.Schedule != nil {
		current.Schedule = *patch.Schedule
	}
	if patch.Budget != nil {
		current.Budget = patch.Budget
	}
	if patch.BidStrategy != nil {
		current.BidStrategy = *patch.BidStrategy
	}
	if patch.FrequencyCap != nil {
		current.FrequencyCap = patch.FrequencyCap
	}
	return current
}

func applyMerged(update *ent.AdGroupUpdateOne, merged dtos.AdSetInput) {
	placements := merged.Placements
	if placements == nil {
		placements = []string{}
	}
	start, _ := time.Parse(time.RFC3339, merged.Schedule.StartAt)
	update.SetName(merged.Name).SetAudience(merged.Audience).SetPlacementMode(adgroup.PlacementMode(merged.PlacementMode)).SetPlacements(placements).SetStartAt(start).SetBidType(adgroup.BidType(merged.BidStrategy.Type))
	if merged.Schedule.EndAt != nil {
		end, _ := time.Parse(time.RFC3339, *merged.Schedule.EndAt)
		update.SetEndAt(end)
	}
	if merged.Budget != nil {
		update.SetBudgetType(adgroup.BudgetType(merged.Budget.Type)).SetBudgetAmountMinor(merged.Budget.Amount.AmountMinor)
	}
	if merged.BidStrategy.Amount != nil {
		update.SetBidAmountMinor(merged.BidStrategy.Amount.AmountMinor)
	} else {
		update.ClearBidAmountMinor()
	}
	if merged.FrequencyCap != nil {
		update.SetFrequencyCapImpressions(merged.FrequencyCap.Impressions).SetFrequencyCapPerDays(merged.FrequencyCap.PerDays)
	}
}

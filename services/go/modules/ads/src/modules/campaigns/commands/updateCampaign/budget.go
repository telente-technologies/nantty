package updatecampaign

import (
	"time"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
)

func parseTime(value string) time.Time {
	parsed, _ := time.Parse(time.RFC3339, value)
	return parsed
}

func applyBudgetAndCap(update *ent.AdCampaignUpdateOne, merged dtos.CampaignInput) {
	if merged.Budget != nil {
		update.SetBudgetType(adcampaign.BudgetType(merged.Budget.Type)).SetBudgetAmountMinor(merged.Budget.Amount.AmountMinor)
	}
	if merged.SpendCap != nil {
		update.SetSpendCapMinor(merged.SpendCap.AmountMinor)
	} else {
		update.ClearSpendCapMinor()
	}
	if merged.Schedule.EndAt != nil {
		update.SetEndAt(parseTime(*merged.Schedule.EndAt))
	} else {
		update.ClearEndAt()
	}
}

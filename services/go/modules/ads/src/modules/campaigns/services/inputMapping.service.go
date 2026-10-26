package services

import (
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/generated/ent/adgroup"
	"nantty/modules/ads/src/modules/campaigns/dtos"
)

func mustParse(value string) time.Time {
	parsed, _ := time.Parse(time.RFC3339, value)
	return parsed
}

func parseOptional(value *string) *time.Time {
	if value == nil {
		return nil
	}
	parsed := mustParse(*value)
	return &parsed
}

func ApplyCampaignInput(create *ent.AdCampaignCreate, input dtos.CampaignInput) *ent.AdCampaignCreate {
	create.SetName(input.Name).SetObjective(adcampaign.Objective(input.Objective)).SetBudgetLevel(adcampaign.BudgetLevel(input.BudgetLevel)).SetStartAt(mustParse(input.Schedule.StartAt))
	if end := parseOptional(input.Schedule.EndAt); end != nil {
		create.SetEndAt(*end)
	}
	if input.Budget != nil {
		create.SetBudgetType(adcampaign.BudgetType(input.Budget.Type)).SetBudgetAmountMinor(input.Budget.Amount.AmountMinor)
	}
	if input.SpendCap != nil {
		create.SetSpendCapMinor(input.SpendCap.AmountMinor)
	}
	if input.AdCategory != "" {
		create.SetAdCategory(input.AdCategory)
	}
	return create
}

func ApplyAdSetInput(create *ent.AdGroupCreate, input dtos.AdSetInput) *ent.AdGroupCreate {
	placements := input.Placements
	if placements == nil {
		placements = []string{}
	}
	create.SetName(input.Name).SetAudience(input.Audience).SetPlacementMode(adgroup.PlacementMode(input.PlacementMode)).SetPlacements(placements).
		SetStartAt(mustParse(input.Schedule.StartAt)).SetBidType(adgroup.BidType(input.BidStrategy.Type))
	if end := parseOptional(input.Schedule.EndAt); end != nil {
		create.SetEndAt(*end)
	}
	if input.Budget != nil {
		create.SetBudgetType(adgroup.BudgetType(input.Budget.Type)).SetBudgetAmountMinor(input.Budget.Amount.AmountMinor)
	}
	if input.BidStrategy.Amount != nil {
		create.SetBidAmountMinor(input.BidStrategy.Amount.AmountMinor)
	}
	if input.FrequencyCap != nil {
		create.SetFrequencyCapImpressions(input.FrequencyCap.Impressions).SetFrequencyCapPerDays(input.FrequencyCap.PerDays)
	}
	if input.ConversionEventId != nil {
		create.SetConversionEventID(*input.ConversionEventId)
	}
	return create
}

func AdSetInputFromRow(group *ent.AdGroup, currency string) dtos.AdSetInput {
	presented := PresentAdSet(group, currency, 0, dtos.DeliverySummary{})
	return dtos.AdSetInput{
		Name: presented.Name, Audience: presented.Audience, PlacementMode: presented.PlacementMode, Placements: presented.Placements, Schedule: presented.Schedule,
		Budget: presented.Budget, BidStrategy: presented.BidStrategy, FrequencyCap: presented.FrequencyCap, ConversionEventId: presented.ConversionEventId,
	}
}

func CampaignInputFromRow(campaign *ent.AdCampaign, currency string) dtos.CampaignInput {
	presented := PresentCampaign(campaign, currency, 0, 0, 0, dtos.DeliverySummary{})
	return dtos.CampaignInput{Name: presented.Name, Objective: presented.Objective, BudgetLevel: presented.BudgetLevel, Budget: presented.Budget, SpendCap: presented.SpendCap, Schedule: presented.Schedule, AdCategory: presented.AdCategory}
}

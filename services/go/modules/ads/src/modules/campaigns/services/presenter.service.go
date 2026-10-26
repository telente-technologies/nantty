package services

import (
	"time"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/types"
)

func formatTime(at time.Time) string { return at.UTC().Format(time.RFC3339) }

func optionalTime(at *time.Time) *string {
	if at == nil {
		return nil
	}
	formatted := formatTime(*at)
	return &formatted
}

func budgetOf(budgetType *string, amountMinor *int64, currency string) *types.Budget {
	if budgetType == nil || amountMinor == nil {
		return nil
	}
	return &types.Budget{Type: *budgetType, Amount: types.Money{AmountMinor: *amountMinor, Currency: currency}}
}

func PresentCampaign(campaign *ent.AdCampaign, currency string, adSetCount, adCount, rejectedAdCount int, delivery dtos.DeliverySummary) dtos.Campaign {
	var budgetType *string
	if campaign.BudgetType != nil {
		value := string(*campaign.BudgetType)
		budgetType = &value
	}
	presented := dtos.Campaign{
		Id: campaign.ID.String(), AccountId: campaign.AccountID.String(), Name: campaign.Name, Objective: string(campaign.Objective), Status: string(campaign.Status), BudgetLevel: string(campaign.BudgetLevel),
		Budget: budgetOf(budgetType, campaign.BudgetAmountMinor, currency), Schedule: types.Schedule{StartAt: formatTime(campaign.StartAt), EndAt: optionalTime(campaign.EndAt)},
		AdCategory: campaign.AdCategory, AdSetCount: adSetCount, AdCount: adCount, RejectedAdCount: rejectedAdCount, Delivery: delivery, CreatedAt: formatTime(campaign.CreatedAt), UpdatedAt: formatTime(campaign.UpdatedAt),
	}
	if campaign.SpendCapMinor != nil {
		presented.SpendCap = &types.Money{AmountMinor: *campaign.SpendCapMinor, Currency: currency}
	}
	return presented
}

func PresentAdSet(group *ent.AdGroup, currency string, adCount int, delivery dtos.DeliverySummary) dtos.AdSet {
	var budgetType *string
	if group.BudgetType != nil {
		value := string(*group.BudgetType)
		budgetType = &value
	}
	bid := types.BidStrategy{Type: string(group.BidType)}
	if group.BidAmountMinor != nil {
		bid.Amount = &types.Money{AmountMinor: *group.BidAmountMinor, Currency: currency}
	}
	presented := dtos.AdSet{
		Id: group.ID.String(), AccountId: group.AccountID.String(), CampaignId: group.CampaignID.String(), Name: group.Name, Status: string(group.Status), Audience: normalizeAudience(group.Audience),
		PlacementMode: string(group.PlacementMode), Placements: group.Placements, Schedule: types.Schedule{StartAt: formatTime(group.StartAt), EndAt: optionalTime(group.EndAt)},
		Budget: budgetOf(budgetType, group.BudgetAmountMinor, currency), BidStrategy: bid, AdCount: adCount, Delivery: delivery, CreatedAt: formatTime(group.CreatedAt), UpdatedAt: formatTime(group.UpdatedAt),
	}
	if group.FrequencyCapImpressions != nil && group.FrequencyCapPerDays != nil {
		presented.FrequencyCap = &types.FrequencyCap{Impressions: *group.FrequencyCapImpressions, PerDays: *group.FrequencyCapPerDays}
	}
	if group.ConversionEventID != "" {
		presented.ConversionEventId = &group.ConversionEventID
	}
	if group.ExperimentID != nil {
		experimentId := group.ExperimentID.String()
		presented.ExperimentId = &experimentId
	}
	if presented.Placements == nil {
		presented.Placements = []string{}
	}
	return presented
}

func normalizeAudience(audience types.AudienceSpec) types.AudienceSpec {
	if audience.Locations == nil {
		audience.Locations = []types.LocationTarget{}
	}
	if audience.ExcludedLocations == nil {
		audience.ExcludedLocations = []types.LocationTarget{}
	}
	for _, list := range []*[]string{&audience.TopicIds, &audience.BehaviourIds, &audience.CustomAudienceIds, &audience.ExcludedCustomAudienceIds} {
		if *list == nil {
			*list = []string{}
		}
	}
	return audience
}

func PresentAd(row *ent.Ad, delivery dtos.DeliverySummary) dtos.Ad {
	review := dtos.AdReview{Status: string(row.ReviewStatus), ReviewedAt: optionalTime(row.ReviewedAt)}
	if row.PolicyCode != "" {
		review.PolicyCode = &row.PolicyCode
	}
	if row.PolicyReason != "" {
		review.PolicyReason = &row.PolicyReason
	}
	if row.AppealStatus != nil {
		appeal := &dtos.AdAppeal{Status: string(*row.AppealStatus), Message: row.AppealMessage, ResolvedAt: optionalTime(row.AppealResolvedAt)}
		if row.AppealSubmittedAt != nil {
			appeal.SubmittedAt = formatTime(*row.AppealSubmittedAt)
		}
		if row.AppealResolutionNote != "" {
			appeal.ResolutionNote = &row.AppealResolutionNote
		}
		review.Appeal = appeal
	}
	return dtos.Ad{
		Id: row.ID.String(), AccountId: row.AccountID.String(), CampaignId: row.CampaignID.String(), AdSetId: row.AdGroupID.String(), Name: row.Name, Status: string(row.Status),
		Review: review, Creative: row.Creative.Resolved, Delivery: delivery, CreatedAt: formatTime(row.CreatedAt), UpdatedAt: formatTime(row.UpdatedAt),
	}
}

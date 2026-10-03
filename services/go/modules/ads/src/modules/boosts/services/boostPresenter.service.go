package services

import (
	"context"
	"github.com/google/uuid"
	"time"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	campaignservices "zudomart/modules/ads/src/modules/campaigns/services"
	"zudomart/modules/ads/src/types"
)

func PresentBoost(ctx context.Context, client *ent.Client, row *ent.AdBoost, today string) (dtos.Boost, error) {
	delivery, err := campaignservices.LoadDelivery(ctx, client, "campaign", []uuid.UUID{row.CampaignID}, campaignservices.DeliveryWindow{Today: today})
	if err != nil {
		return dtos.Boost{}, err
	}
	raw := delivery[row.CampaignID]
	results := dtos.BoostResults{Impressions: raw.Impressions, Reach: raw.Reach}
	switch row.Goal {
	case adboost.GoalProfileVisits:
		results.ProfileVisits = raw.Clicks
	case adboost.GoalMessages:
		results.Messages = raw.Conversions
	}
	presented := dtos.Boost{
		Id: row.ID.String(), PostId: row.PostID, Status: string(row.Status), Goal: string(row.Goal), TotalBudget: types.Money{AmountMinor: row.TotalBudgetMinor, Currency: row.Currency},
		Spent: types.Money{AmountMinor: raw.SpendMicros / types.MicrosPerMinorUnit, Currency: row.Currency}, Results: results,
	}
	if row.StartsAt != nil {
		formatted := row.StartsAt.UTC().Format(time.RFC3339)
		presented.StartsAt = &formatted
	}
	if row.EndsAt != nil {
		formatted := row.EndsAt.UTC().Format(time.RFC3339)
		presented.EndsAt = &formatted
	}
	if row.RejectionReason != "" {
		presented.RejectionReason = &row.RejectionReason
	}
	return presented, nil
}

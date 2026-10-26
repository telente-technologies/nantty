package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/modules/boosts/dtos"
	campaignservices "nantty/modules/ads/src/modules/campaigns/services"
	"nantty/modules/ads/src/types"
)

var keyResultLabels = map[adboost.Goal]string{
	adboost.GoalViews: "People reached", adboost.GoalProfileVisits: "Profile visits", adboost.GoalStoreVisits: "Store visits",
	adboost.GoalProductVisits: "Product views", adboost.GoalMessages: "Messages",
}

func KeyResultLabelFor(goal adboost.Goal) string { return keyResultLabels[goal] }

func KeyResultValue(goal adboost.Goal, raw campaignservices.RawDelivery) int64 {
	switch goal {
	case adboost.GoalProfileVisits, adboost.GoalStoreVisits, adboost.GoalProductVisits:
		return raw.Clicks
	case adboost.GoalMessages:
		return raw.Conversions
	}
	return raw.Reach
}

func PresentBoost(ctx context.Context, client *ent.Client, row *ent.AdBoost, today string, now time.Time) (dtos.Boost, error) {
	presented, err := PresentBoosts(ctx, client, []*ent.AdBoost{row}, today, now)
	if err != nil || len(presented) == 0 {
		return dtos.Boost{}, err
	}
	return presented[0], nil
}

func PresentBoosts(ctx context.Context, client *ent.Client, rows []*ent.AdBoost, today string, now time.Time) ([]dtos.Boost, error) {
	campaignIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		campaignIds = append(campaignIds, row.CampaignID)
	}
	delivery, err := campaignservices.LoadDelivery(ctx, client, "campaign", campaignIds, campaignservices.DeliveryWindow{Today: today})
	if err != nil {
		return nil, err
	}
	presented := make([]dtos.Boost, 0, len(rows))
	for _, row := range rows {
		presented = append(presented, presentBoostRow(row, delivery[row.CampaignID], now))
	}
	return presented, nil
}

func presentBoostRow(row *ent.AdBoost, raw campaignservices.RawDelivery, now time.Time) dtos.Boost {
	results := dtos.BoostResults{Impressions: raw.Impressions, Reach: raw.Reach, Clicks: raw.Clicks}
	switch row.Goal {
	case adboost.GoalProfileVisits:
		results.ProfileVisits = raw.Clicks
	case adboost.GoalStoreVisits:
		results.StoreVisits = raw.Clicks
	case adboost.GoalProductVisits:
		results.ProductVisits = raw.Clicks
	case adboost.GoalMessages:
		results.Messages = raw.Conversions
	}
	spent := types.Money{AmountMinor: raw.SpendMicros / types.MicrosPerMinorUnit, Currency: row.Currency}
	keyResult := dtos.BoostKeyResult{Label: KeyResultLabelFor(row.Goal), Value: KeyResultValue(row.Goal, raw)}
	var audience dtos.BoostAudience
	_ = json.Unmarshal(row.Audience, &audience)
	presented := dtos.Boost{
		Id: row.ID.String(), PostId: postIdFor(row), DestinationType: string(row.DestinationType), TargetId: row.PostID, Status: string(row.Status), Goal: string(row.Goal),
		BudgetType: string(row.BudgetType), DailyBudget: types.Money{AmountMinor: row.DailyBudgetMinor, Currency: row.Currency}, DurationDays: row.DurationDays,
		TotalBudget: types.Money{AmountMinor: row.TotalBudgetMinor, Currency: row.Currency}, Spent: spent, Results: results, KeyResult: keyResult,
		PaymentMethod: string(row.PaymentMethod), Audience: audience, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), Actions: BoostActionsFor(row, now),
	}
	if keyResult.Value > 0 && spent.AmountMinor > 0 {
		presented.CostPerResult = &types.Money{AmountMinor: spent.AmountMinor / keyResult.Value, Currency: row.Currency}
	}
	presented.StartsAt, presented.EndsAt, presented.ScheduledStartAt = formatTime(row.StartsAt), formatTime(row.EndsAt), formatTime(row.ScheduledStartAt)
	if row.RejectionReason != "" {
		presented.RejectionReason = &row.RejectionReason
	}
	return presented
}

func BoostActionsFor(row *ent.AdBoost, now time.Time) dtos.BoostActions {
	ended := row.EndsAt != nil && !row.EndsAt.After(now)
	return dtos.BoostActions{
		Pause: row.Status == adboost.StatusActive && !ended, Resume: row.Status == adboost.StatusPaused && !ended,
		Stop: isCancellable(row.Status), ChangeBudget: CanChangeBoostBudget(row.Status), Resubmit: row.Status == adboost.StatusRejected,
	}
}

func CanChangeBoostBudget(status adboost.Status) bool {
	return status == adboost.StatusInReview || status == adboost.StatusActive || status == adboost.StatusPaused
}

func formatTime(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}

func postIdFor(row *ent.AdBoost) string {
	if row.DestinationType == adboost.DestinationTypePost {
		return row.PostID
	}
	return ""
}

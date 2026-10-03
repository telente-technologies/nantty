package decideadforslot

import (
	"context"
	"slices"
	"time"

	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

func (handler Handler) collectEligibleCandidates(ctx context.Context, slot *slotContext) ([]types.CandidateAd, error) {
	snapshot, err := handler.Container.Candidates.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	var contentTopics []string
	if slot.signal != nil {
		contentTopics = slot.signal.Topics
	}
	var eligible []types.CandidateAd
	for _, candidate := range snapshot {
		if !slices.Contains(candidate.Placements, slot.placement) || !services.CreativeFitsSlotKind(candidate.Creative.Format, slot.command.Slot.Kind) {
			continue
		}
		if candidate.AvailableFundsMicros <= 0 || candidate.StartAt.After(slot.now) || (candidate.EndAt != nil && !candidate.EndAt.After(slot.now)) {
			continue
		}
		if matched, _ := services.MatchesTargeting(candidate.Audience, slot.command.Viewer, contentTopics); !matched {
			continue
		}
		withinBudget, err := handler.passesBudgetGates(ctx, candidate, slot.now)
		if err != nil {
			return nil, err
		}
		if !withinBudget {
			continue
		}
		verdict, err := handler.Container.Frequency.Check(ctx, slot.formatCap, slot.totalCap, scopeFor(slot, candidate))
		if err != nil {
			return nil, err
		}
		if verdict.Allowed {
			eligible = append(eligible, candidate)
		}
	}
	return eligible, nil
}

func (handler Handler) passesBudgetGates(ctx context.Context, candidate types.CandidateAd, now time.Time) (bool, error) {
	location, err := time.LoadLocation(candidate.Timezone)
	if err != nil {
		location = time.UTC
	}
	dayStart, dayEnd := services.DayWindowInLocation(now, location)
	reading, err := handler.Container.Spend.Read(ctx, services.SpendScope{
		AccountId: candidate.AccountId, CampaignId: candidate.CampaignId, AdGroupId: candidate.AdGroupId,
		Day: services.DayKeyInTimezone(now, candidate.Timezone), Month: now.UTC().Format("2006-01"),
	})
	if err != nil {
		return false, err
	}
	if candidate.MonthlySpendLimit != nil && reading.AccountMonth >= *candidate.MonthlySpendLimit*types.MicrosPerMinorUnit {
		return false, nil
	}
	if candidate.SpendCapMicros > 0 && reading.CampaignLifetime >= candidate.SpendCapMicros {
		return false, nil
	}
	input := services.PacingInput{Now: now, DayStart: dayStart, DayEnd: dayEnd, ScheduleEnd: candidate.EndAt, BurstBps: handler.Container.Settings.PacingBurstBps, MinimumUpfrontBps: handler.Container.Settings.PacingUpfrontBps}
	if candidate.GroupBudgetMicros > 0 {
		input.BudgetType, input.BudgetMicros, input.SpentTodayMicros, input.SpentLifetimeMicros = candidate.GroupBudgetType, candidate.GroupBudgetMicros, reading.GroupToday, reading.GroupLifetime
		return services.DecidePacing(input).Deliver, nil
	}
	input.BudgetType, input.BudgetMicros, input.SpentTodayMicros, input.SpentLifetimeMicros = candidate.CampaignBudgetType, candidate.CampaignBudgetMicros, reading.CampaignToday, reading.CampaignLifetime
	return services.DecidePacing(input).Deliver, nil
}

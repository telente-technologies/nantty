package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adconversion"
	"zudomart/modules/ads/src/generated/ent/adconversionevent"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/modules/tools/dtos"
)

func formatOptional(at *time.Time) *string {
	if at == nil {
		return nil
	}
	formatted := at.UTC().Format(time.RFC3339)
	return &formatted
}

type ConversionActivity struct {
	LastReceivedAt *time.Time
	CountLast7Days int64
}

func ReadConversionActivity(ctx context.Context, client *ent.Client, event *ent.AdConversionEvent, now time.Time) ConversionActivity {
	if event.EventType != adconversionevent.EventTypePurchase {
		return ConversionActivity{}
	}
	base := client.AdConversion.Query().Where(adconversion.AccountID(event.AccountID), adconversion.StoreID(event.StoreID))
	activity := ConversionActivity{}
	if count, err := base.Clone().Where(adconversion.OccurredAtGTE(now.Add(-7 * 24 * time.Hour))).Count(ctx); err == nil {
		activity.CountLast7Days = int64(count)
	}
	if latest, err := base.Clone().Order(ent.Desc(adconversion.FieldOccurredAt)).First(ctx); err == nil {
		activity.LastReceivedAt = &latest.OccurredAt
	}
	return activity
}

func PresentConversionEvent(event *ent.AdConversionEvent, activity ConversionActivity) dtos.ConversionEvent {
	status := string(event.Status)
	if event.Status == adconversionevent.StatusActive && activity.CountLast7Days == 0 {
		status = "no_recent_activity"
	}
	return dtos.ConversionEvent{
		Id: event.ID.String(), Name: event.Name, EventType: string(event.EventType), StoreId: event.StoreID, StoreName: event.StoreName, IsBuiltIn: event.IsBuiltIn,
		Status: status, LastReceivedAt: formatOptional(activity.LastReceivedAt), CountLast7Days: activity.CountLast7Days, TracksValue: event.TracksValue,
	}
}

func PresentExperiments(ctx context.Context, client *ent.Client, rows []*ent.AdExperiment) ([]dtos.Experiment, error) {
	campaignIds, adSetIds := []uuid.UUID{}, []uuid.UUID{}
	for _, row := range rows {
		campaignIds = append(campaignIds, row.CampaignID)
		for _, arm := range row.Arms {
			if id, err := uuid.Parse(arm.AdSetId); err == nil {
				adSetIds = append(adSetIds, id)
			}
		}
	}
	campaigns, err := client.AdCampaign.Query().Where(adcampaign.IDIn(campaignIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	groups, err := client.AdGroup.Query().Where(adgroup.IDIn(adSetIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	names := map[string]string{}
	for _, campaign := range campaigns {
		names[campaign.ID.String()] = campaign.Name
	}
	for _, group := range groups {
		names[group.ID.String()] = group.Name
	}
	presented := make([]dtos.Experiment, 0, len(rows))
	for _, row := range rows {
		arms := make([]dtos.ExperimentArm, 0, len(row.Arms))
		for _, arm := range row.Arms {
			arms = append(arms, dtos.ExperimentArm{AdSetId: arm.AdSetId, AdSetName: names[arm.AdSetId], TrafficPercent: arm.TrafficPercent, Note: ""})
		}
		presented = append(presented, dtos.Experiment{
			Id: row.ID.String(), Name: row.Name, CampaignId: row.CampaignID.String(), CampaignName: names[row.CampaignID.String()], Variable: string(row.Variable), Metric: string(row.Metric),
			Status: string(row.Status), Arms: arms, StartAt: row.StartAt.UTC().Format(time.RFC3339), EndAt: row.EndAt.UTC().Format(time.RFC3339), Result: row.Result,
			CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
		})
	}
	return presented, nil
}

func PresentRule(rule *ent.AdAutomatedRule) dtos.AutomatedRule {
	return dtos.AutomatedRule{
		Id: rule.ID.String(), Name: rule.Name, Status: string(rule.Status), Level: string(rule.Level), TargetIds: rule.TargetIds, Conditions: rule.Conditions,
		Action: dtos.RuleAction{Type: string(rule.ActionType), Percent: rule.ActionPercent}, CheckEveryMinutes: rule.CheckEveryMinutes,
		LastRunAt: formatOptional(rule.LastRunAt), LastTriggeredAt: formatOptional(rule.LastTriggeredAt), TriggerCount: rule.TriggerCount, CreatedAt: rule.CreatedAt.UTC().Format(time.RFC3339),
	}
}

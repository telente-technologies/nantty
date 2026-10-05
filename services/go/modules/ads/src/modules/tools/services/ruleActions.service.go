package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adgroup"
)

func TargetIsDelivering(ctx context.Context, client *ent.Client, level string, id uuid.UUID) (bool, error) {
	switch level {
	case "campaign":
		return client.AdCampaign.Query().Where(adcampaign.ID(id), adcampaign.StatusEQ(adcampaign.StatusActive)).Exist(ctx)
	case "ad_set":
		return client.AdGroup.Query().Where(adgroup.ID(id), adgroup.StatusEQ(adgroup.StatusActive)).Exist(ctx)
	}
	return client.Ad.Query().Where(ad.ID(id), ad.StatusEQ(ad.StatusActive)).Exist(ctx)
}

func ApplyRuleActionInTransaction(ctx context.Context, tx *ent.Tx, level, action string, percent int, id uuid.UUID) error {
	switch action {
	case "pause":
		return pauseTarget(ctx, tx, level, id)
	case "increase_budget":
		return scaleBudget(ctx, tx, level, id, 100+percent)
	case "decrease_budget":
		return scaleBudget(ctx, tx, level, id, 100-percent)
	}
	return nil
}

func pauseTarget(ctx context.Context, tx *ent.Tx, level string, id uuid.UUID) error {
	switch level {
	case "campaign":
		return tx.AdCampaign.Update().Where(adcampaign.ID(id), adcampaign.StatusEQ(adcampaign.StatusActive)).SetStatus(adcampaign.StatusPaused).Exec(ctx)
	case "ad_set":
		return tx.AdGroup.Update().Where(adgroup.ID(id), adgroup.StatusEQ(adgroup.StatusActive)).SetStatus(adgroup.StatusPaused).Exec(ctx)
	}
	return tx.Ad.Update().Where(ad.ID(id), ad.StatusEQ(ad.StatusActive)).SetStatus(ad.StatusPaused).Exec(ctx)
}

func scaleBudget(ctx context.Context, tx *ent.Tx, level string, id uuid.UUID, percentOfCurrent int) error {
	scale := func(current *int64) (int64, bool) {
		if current == nil {
			return 0, false
		}
		return max(1, *current*int64(percentOfCurrent)/100), true
	}
	if level == "campaign" {
		campaign, err := tx.AdCampaign.Get(ctx, id)
		if err != nil {
			return err
		}
		if amount, ok := scale(campaign.BudgetAmountMinor); ok {
			return tx.AdCampaign.UpdateOneID(id).SetBudgetAmountMinor(amount).Exec(ctx)
		}
		return nil
	}
	group, err := tx.AdGroup.Get(ctx, id)
	if err != nil {
		return err
	}
	if amount, ok := scale(group.BudgetAmountMinor); ok {
		return tx.AdGroup.UpdateOneID(id).SetBudgetAmountMinor(amount).Exec(ctx)
	}
	return nil
}

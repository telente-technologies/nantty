package services

import (
	"context"
	"time"

	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adboost"
	"nantty/modules/ads/src/generated/ent/adboostchange"
	"nantty/modules/ads/src/generated/ent/adcampaign"
	"nantty/modules/ads/src/modules/boosts/dtos"
	"nantty/platform/httpserver"
)

const maximumExtraDays = 30

type BudgetChangePlan struct {
	ExtraDays       int
	AdditionalMinor int64
	NewDailyMinor   int64
	NewTotalMinor   int64
	NewDurationDays int
	NewEndsAt       *time.Time
}

func invalidChange(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func remainingBoostDays(boost *ent.AdBoost, now time.Time) int64 {
	if boost.EndsAt == nil {
		return int64(boost.DurationDays)
	}
	left := boost.EndsAt.Sub(now)
	if left <= 0 {
		return 0
	}
	return int64((left + 24*time.Hour - 1) / (24 * time.Hour))
}

func PlanBoostBudgetChange(boost *ent.AdBoost, request dtos.BoostBudgetChangeRequest, minimumDailyMinor int64, now time.Time) (BudgetChangePlan, error) {
	if !CanChangeBoostBudget(boost.Status) {
		return BudgetChangePlan{}, adserrors.BoostBudgetChangeRefused
	}
	if request.ExtraDays < 0 || request.ExtraDays > maximumExtraDays || boost.DurationDays+request.ExtraDays > MaximumChangedDurationDays {
		return BudgetChangePlan{}, invalidChange("extraDays", "Add between 0 and 30 days, up to 90 days in total.")
	}
	plan := BudgetChangePlan{ExtraDays: request.ExtraDays, NewDurationDays: boost.DurationDays + request.ExtraDays, NewDailyMinor: boost.DailyBudgetMinor}
	if boost.BudgetType == adboost.BudgetTypeTotal {
		added := int64(0)
		if request.AdditionalBudget != nil {
			if request.AdditionalBudget.Currency != boost.Currency || request.AdditionalBudget.AmountMinor < 0 {
				return BudgetChangePlan{}, invalidChange("additionalBudget", "Add a positive amount in the ad's currency.")
			}
			added = request.AdditionalBudget.AmountMinor
		}
		plan.AdditionalMinor = added
		plan.NewTotalMinor = boost.TotalBudgetMinor + added
		plan.NewDailyMinor = (plan.NewTotalMinor + int64(plan.NewDurationDays) - 1) / int64(plan.NewDurationDays)
	} else {
		if request.DailyBudget != nil {
			if request.DailyBudget.Currency != boost.Currency || request.DailyBudget.AmountMinor < boost.DailyBudgetMinor || request.DailyBudget.AmountMinor < minimumDailyMinor {
				return BudgetChangePlan{}, invalidChange("dailyBudget", "The new daily budget must be at least the current one, in the ad's currency.")
			}
			plan.NewDailyMinor = request.DailyBudget.AmountMinor
		}
		plan.AdditionalMinor = (plan.NewDailyMinor-boost.DailyBudgetMinor)*remainingBoostDays(boost, now) + plan.NewDailyMinor*int64(request.ExtraDays)
		plan.NewTotalMinor = boost.TotalBudgetMinor + plan.AdditionalMinor
	}
	if plan.AdditionalMinor == 0 && plan.ExtraDays == 0 {
		return BudgetChangePlan{}, invalidChange("extraDays", "Add days or budget to change this ad.")
	}
	if boost.EndsAt != nil {
		ends := boost.EndsAt.AddDate(0, 0, request.ExtraDays)
		plan.NewEndsAt = &ends
	}
	return plan, nil
}

func ApplyBoostBudgetChangeInTransaction(ctx context.Context, tx *ent.Tx, boost *ent.AdBoost, extraDays int, newDailyMinor, additionalMinor int64) error {
	update := tx.AdBoost.UpdateOneID(boost.ID).SetDailyBudgetMinor(newDailyMinor).AddDurationDays(extraDays).AddTotalBudgetMinor(additionalMinor).AddAddedBudgetMinor(additionalMinor)
	if boost.EndsAt != nil {
		update.SetEndsAt(boost.EndsAt.AddDate(0, 0, extraDays))
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	campaign, err := tx.AdCampaign.Get(ctx, boost.CampaignID)
	if err != nil {
		return err
	}
	campaignUpdate := tx.AdCampaign.UpdateOneID(campaign.ID).SetBudgetAmountMinor(newDailyMinor)
	if campaign.BudgetType != nil && *campaign.BudgetType == adcampaign.BudgetTypeLifetime {
		campaignUpdate.SetBudgetAmountMinor(boost.TotalBudgetMinor + additionalMinor)
	}
	if campaign.EndAt != nil {
		campaignUpdate.SetEndAt(campaign.EndAt.AddDate(0, 0, extraDays))
	}
	if err := campaignUpdate.Exec(ctx); err != nil {
		return err
	}
	group, err := tx.AdGroup.Get(ctx, boost.AdGroupID)
	if err != nil || group.EndAt == nil {
		return err
	}
	return tx.AdGroup.UpdateOneID(group.ID).SetEndAt(group.EndAt.AddDate(0, 0, extraDays)).Exec(ctx)
}

func ApplyBoostChangesPaidByTopUp(ctx context.Context, client *ent.Client, runInTransaction func(context.Context, func(*ent.Tx) error) error, topUpId string, now time.Time) error {
	if topUpId == "" {
		return nil
	}
	return runInTransaction(ctx, func(tx *ent.Tx) error {
		changes, err := tx.AdBoostChange.Query().Where(adboostchange.PaymentTopUpID(topUpId), adboostchange.StatusEQ(adboostchange.StatusPendingPayment)).ForUpdate().All(ctx)
		if err != nil {
			return err
		}
		for _, change := range changes {
			boost, err := tx.AdBoost.Query().Where(adboost.ID(change.BoostID)).ForUpdate().Only(ctx)
			if err != nil {
				return err
			}
			if !CanChangeBoostBudget(boost.Status) {
				if err := tx.AdBoostChange.UpdateOneID(change.ID).SetStatus(adboostchange.StatusUnapplied).Exec(ctx); err != nil {
					return err
				}
				continue
			}
			if err := ApplyBoostBudgetChangeInTransaction(ctx, tx, boost, change.ExtraDays, change.NewDailyBudgetMinor, change.AdditionalMinor); err != nil {
				return err
			}
			if err := tx.AdBoostChange.UpdateOneID(change.ID).SetStatus(adboostchange.StatusApplied).SetAppliedAt(now).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	})
}

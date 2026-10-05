package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adexperiment"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/types"
)

func FinishExperimentInTransaction(ctx context.Context, tx *ent.Tx, database *sql.DB, experiment *ent.AdExperiment, status adexperiment.Status, now time.Time) (*ent.AdExperiment, error) {
	update := tx.AdExperiment.UpdateOneID(experiment.ID).SetStatus(status)
	if status == adexperiment.StatusStopped && experiment.EndAt.After(now) {
		update.SetEndAt(now)
	}
	if experiment.Status == adexperiment.StatusRunning {
		result, err := measureExperiment(ctx, tx, database, experiment)
		if err != nil {
			return nil, err
		}
		update.SetResult(&result)
	}
	saved, err := update.Save(ctx)
	if err != nil {
		return nil, err
	}
	return saved, tx.AdGroup.Update().Where(adgroup.ExperimentID(experiment.ID)).ClearExperimentID().Exec(ctx)
}

func measureExperiment(ctx context.Context, tx *ent.Tx, database *sql.DB, experiment *ent.AdExperiment) (types.ExperimentResult, error) {
	arms := make([]ArmTotals, 0, len(experiment.Arms))
	fromDay := experiment.StartAt.UTC().AddDate(0, 0, -1).Format("2006-01-02")
	for _, arm := range experiment.Arms {
		id, err := uuid.Parse(arm.AdSetId)
		if err != nil {
			continue
		}
		totals, err := ReadDeliveryTotals(ctx, database, "ad_set", id, fromDay)
		if err != nil {
			return types.ExperimentResult{}, err
		}
		name := ""
		if group, err := tx.AdGroup.Get(ctx, id); err == nil {
			name = group.Name
		}
		arms = append(arms, ArmTotals{AdSetId: arm.AdSetId, AdSetName: name, Totals: totals})
	}
	return DecideExperiment(string(experiment.Metric), arms), nil
}

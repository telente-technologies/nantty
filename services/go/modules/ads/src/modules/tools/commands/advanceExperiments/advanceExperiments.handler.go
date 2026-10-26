package advanceexperiments

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adexperiment"
	"nantty/modules/ads/src/modules/tools/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context) error {
	deployed := handler.Container
	now := deployed.Now()
	if err := deployed.Client.AdExperiment.Update().Where(adexperiment.StatusEQ(adexperiment.StatusDraft), adexperiment.StartAtLTE(now)).SetStatus(adexperiment.StatusRunning).Exec(ctx); err != nil {
		return err
	}
	finished, err := deployed.Client.AdExperiment.Query().Where(adexperiment.StatusEQ(adexperiment.StatusRunning), adexperiment.EndAtLTE(now)).Limit(100).All(ctx)
	if err != nil {
		return err
	}
	for _, experiment := range finished {
		err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
			_, err := services.FinishExperimentInTransaction(ctx, tx, deployed.Database, experiment, adexperiment.StatusCompleted, now)
			return err
		})
		if err != nil {
			return err
		}
	}
	return nil
}

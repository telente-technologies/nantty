package stopexperiment

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adexperiment"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/tools/dtos"
	"nantty/modules/ads/src/modules/tools/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Experiment, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionToolsManage)
	if err != nil {
		return dtos.Experiment{}, err
	}
	id, err := uuid.Parse(command.ExperimentId)
	if err != nil {
		return dtos.Experiment{}, adserrors.ExperimentNotFound
	}
	experiment, err := deployed.Client.AdExperiment.Query().Where(adexperiment.ID(id), adexperiment.AccountID(account.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.Experiment{}, adserrors.ExperimentNotFound
	}
	if err != nil {
		return dtos.Experiment{}, err
	}
	if experiment.Status != adexperiment.StatusRunning && experiment.Status != adexperiment.StatusDraft {
		return dtos.Experiment{}, adserrors.ExperimentNotRunning
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if experiment, err = services.FinishExperimentInTransaction(ctx, tx, deployed.Database, experiment, adexperiment.StatusStopped, deployed.Now()); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "experiment", experiment.ID.String(), actor, "Stopped test "+experiment.Name, nil)
	})
	if err != nil {
		return dtos.Experiment{}, err
	}
	presented, err := services.PresentExperiments(ctx, deployed.Client, []*ent.AdExperiment{experiment})
	if err != nil {
		return dtos.Experiment{}, err
	}
	return presented[0], nil
}

package createexperiment

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/adexperiment"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/tools/dtos"
	"zudomart/modules/ads/src/modules/tools/services"
	"zudomart/modules/ads/src/modules/tools/validators"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func issue(path, message string) error {
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: path, Message: message}})
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Experiment, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionToolsManage)
	if err != nil {
		return dtos.Experiment{}, err
	}
	start, end, err := validators.ValidateExperimentInput(command.Input)
	if err != nil {
		return dtos.Experiment{}, err
	}
	campaignId, err := uuid.Parse(command.Input.CampaignId)
	if err != nil {
		return dtos.Experiment{}, issue("campaignId", "Choose a campaign.")
	}
	campaign, err := deployed.Client.AdCampaign.Query().Where(adcampaign.ID(campaignId), adcampaign.AccountID(account.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.Experiment{}, issue("campaignId", "Choose a campaign.")
	}
	if err != nil {
		return dtos.Experiment{}, err
	}
	groupIds, err := handler.checkArms(ctx, account.ID, campaign.ID, command.Input)
	if err != nil {
		return dtos.Experiment{}, err
	}
	status := adexperiment.StatusDraft
	if !start.After(deployed.Now()) {
		status = adexperiment.StatusRunning
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var created *ent.AdExperiment
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		created, err = tx.AdExperiment.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID).SetName(strings.TrimSpace(command.Input.Name)).
			SetVariable(adexperiment.Variable(command.Input.Variable)).SetMetric(adexperiment.Metric(command.Input.Metric)).SetStatus(status).SetArms(command.Input.Arms).
			SetStartAt(start).SetEndAt(end).SetCreatedByUserID(command.UserId).Save(ctx)
		if err != nil {
			return err
		}
		claimed, err := tx.AdGroup.Update().Where(adgroup.IDIn(groupIds...), adgroup.ExperimentIDIsNil()).SetExperimentID(created.ID).Save(ctx)
		if err != nil {
			return err
		}
		if claimed != len(groupIds) {
			return issue("arms", "An ad set was added to another test at the same time. Try again.")
		}
		summary := fmt.Sprintf("Started an A/B test on %s", strings.ReplaceAll(command.Input.Variable, "_", " "))
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "experiment", created.ID.String(), actor, summary, command.Input)
	})
	if err != nil {
		return dtos.Experiment{}, err
	}
	presented, err := services.PresentExperiments(ctx, deployed.Client, []*ent.AdExperiment{created})
	if err != nil {
		return dtos.Experiment{}, err
	}
	return presented[0], nil
}

func (handler Handler) checkArms(ctx context.Context, accountId, campaignId uuid.UUID, input dtos.ExperimentInput) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(input.Arms))
	for index, arm := range input.Arms {
		path := fmt.Sprintf("arms.%d.adSetId", index)
		id, err := uuid.Parse(arm.AdSetId)
		if err != nil {
			return nil, issue(path, "Choose an ad set.")
		}
		group, err := handler.Container.Client.AdGroup.Query().Where(adgroup.ID(id), adgroup.AccountID(accountId)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil, issue(path, "Choose an ad set.")
		}
		if err != nil {
			return nil, err
		}
		if group.CampaignID != campaignId {
			return nil, issue(path, "Every ad set must belong to the chosen campaign.")
		}
		if group.ExperimentID != nil {
			return nil, issue(path, fmt.Sprintf("%q is already in another test.", group.Name))
		}
		ids = append(ids, id)
	}
	return ids, nil
}

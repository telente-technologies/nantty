package updatecampaign

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/modules/campaigns/services"
	"zudomart/modules/ads/src/modules/campaigns/validators"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Campaign, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.Campaign{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	campaign, err := loader.FindCampaign(ctx, account.ID, command.CampaignId)
	if err != nil {
		return dtos.Campaign{}, err
	}
	merged, err := handler.mergeAndValidate(campaign, account.Currency, command.Patch)
	if err != nil {
		return dtos.Campaign{}, err
	}
	if command.Patch.Status != nil {
		if err := handler.checkStatusChange(ctx, account, campaign, *command.Patch.Status); err != nil {
			return dtos.Campaign{}, err
		}
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdCampaign.UpdateOneID(campaign.ID).SetName(merged.Name).SetStartAt(parseTime(merged.Schedule.StartAt))
		applyBudgetAndCap(update, merged)
		if merged.Schedule.EndAt != nil {
			update.SetEndAt(parseTime(*merged.Schedule.EndAt))
		}
		if command.Patch.Status != nil {
			update.SetStatus(adcampaign.Status(*command.Patch.Status))
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "campaign", campaign.ID.String(), actor, "Updated campaign "+merged.Name, command.Patch)
	})
	if err != nil {
		return dtos.Campaign{}, err
	}
	saved, err := loader.FindCampaign(ctx, account.ID, campaign.ID)
	if err != nil {
		return dtos.Campaign{}, err
	}
	presented, err := loader.PresentCampaigns(ctx, account, []*ent.AdCampaign{saved}, loader.Window(account, "", ""))
	return presented[0], err
}

func (handler Handler) mergeAndValidate(campaign *ent.AdCampaign, currency string, patch dtos.CampaignPatch) (dtos.CampaignInput, error) {
	merged := services.CampaignInputFromRow(campaign, currency)
	if patch.Objective != nil && *patch.Objective != merged.Objective {
		return merged, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "objective", Message: "The objective cannot be changed."}})
	}
	if patch.Name != nil {
		merged.Name = *patch.Name
	}
	if patch.Budget != nil {
		merged.Budget = patch.Budget
	}
	if patch.SpendCap != nil {
		merged.SpendCap = patch.SpendCap
	}
	if patch.Schedule != nil {
		merged.Schedule = *patch.Schedule
	}
	issues := validators.NewIssues("")
	validators.ValidateCampaignInput(merged, currency, issues, "campaign")
	return merged, issues.Error()
}

func (handler Handler) checkStatusChange(ctx context.Context, account *ent.AdAccount, campaign *ent.AdCampaign, target string) error {
	if err := services.RequireStatusChangeAllowed(string(campaign.Status), target); err != nil {
		return err
	}
	if target != "active" || campaign.Status == adcampaign.StatusActive {
		return nil
	}
	if err := services.RequireFundsToRun(account, handler.Container.Now()); err != nil {
		return err
	}
	approved, err := handler.Container.Client.Ad.Query().Where(ad.CampaignID(campaign.ID), ad.ReviewStatusEQ(ad.ReviewStatusApproved)).Exist(ctx)
	if err != nil || approved {
		return err
	}
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "At least one approved ad is needed to run."}})
}

package updateadset

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/modules/campaigns/services"
	"zudomart/modules/ads/src/modules/campaigns/validators"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdSet, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.AdSet{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	group, err := loader.FindAdSet(ctx, account.ID, command.AdSetId)
	if err != nil {
		return dtos.AdSet{}, err
	}
	campaign, err := loader.FindCampaign(ctx, account.ID, group.CampaignID)
	if err != nil {
		return dtos.AdSet{}, err
	}
	merged := merge(services.AdSetInputFromRow(group, account.Currency), command.Patch)
	issues := validators.NewIssues("")
	validators.ValidateAdSetInput(merged, string(campaign.BudgetLevel), account.Currency, deployed.Pricing.FloorsForAudience(ctx, merged.Audience, account.Currency), issues, "")
	if err := issues.Error(); err != nil {
		return dtos.AdSet{}, err
	}
	if command.Patch.Status != nil {
		if err := handler.checkStatusChange(ctx, account, group, *command.Patch.Status); err != nil {
			return dtos.AdSet{}, err
		}
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.AdGroup.UpdateOneID(group.ID)
		applyMerged(update, merged)
		if command.Patch.Status != nil {
			update.SetStatus(adgroup.Status(*command.Patch.Status))
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "ad_set", group.ID.String(), actor, "Updated ad set "+merged.Name, command.Patch)
	})
	if err != nil {
		return dtos.AdSet{}, err
	}
	saved, err := loader.FindAdSet(ctx, account.ID, group.ID)
	if err != nil {
		return dtos.AdSet{}, err
	}
	presented, err := loader.PresentAdSets(ctx, account, []*ent.AdGroup{saved}, loader.Window(account, "", ""))
	return presented[0], err
}

func (handler Handler) checkStatusChange(ctx context.Context, account *ent.AdAccount, group *ent.AdGroup, target string) error {
	if err := services.RequireStatusChangeAllowed(string(group.Status), target); err != nil {
		return err
	}
	if target != "active" || group.Status == adgroup.StatusActive {
		return nil
	}
	if err := services.RequireFundsToRun(account, handler.Container.Now()); err != nil {
		return err
	}
	approved, err := handler.Container.Client.Ad.Query().Where(ad.AdGroupID(group.ID), ad.ReviewStatusEQ(ad.ReviewStatusApproved)).Exist(ctx)
	if err != nil || approved {
		return err
	}
	return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "At least one approved ad is needed to run."}})
}

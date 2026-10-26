package createadset

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/modules/campaigns/services"
	"nantty/modules/ads/src/modules/campaigns/validators"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.AdSet, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.AdSet{}, err
	}
	if err := accountservices.RequireActiveAccount(account); err != nil {
		return dtos.AdSet{}, err
	}
	campaignId, err := uuid.Parse(command.Request.CampaignId)
	if err != nil {
		return dtos.AdSet{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "campaignId", Message: "Choose a campaign."}})
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	campaign, err := loader.FindCampaign(ctx, account.ID, campaignId)
	if err != nil {
		return dtos.AdSet{}, err
	}
	issues := validators.NewIssues("")
	validators.ValidateAdSetInput(command.Request.AdSetInput, string(campaign.BudgetLevel), account.Currency, deployed.Pricing.FloorsForAudience(ctx, command.Request.AdSetInput.Audience, account.Currency), issues, "")
	if err := issues.Error(); err != nil {
		return dtos.AdSet{}, err
	}
	if err := services.RequireUsableAccountReferences(ctx, deployed.Client, account.ID, command.Request.AdSetInput, ""); err != nil {
		return dtos.AdSet{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var group *ent.AdGroup
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		group, err = services.ApplyAdSetInput(tx.AdGroup.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID), command.Request.AdSetInput).Save(ctx)
		if err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "ad_set", group.ID.String(), actor, "Created ad set "+group.Name, nil)
	})
	if err != nil {
		return dtos.AdSet{}, err
	}
	presented, err := loader.PresentAdSets(ctx, account, []*ent.AdGroup{group}, loader.Window(account, "", ""))
	return presented[0], err
}

package createcampaignbundle

import (
	"context"
	"fmt"
	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/modules/campaigns/services"
	"nantty/modules/ads/src/modules/campaigns/validators"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.CampaignDraftResult, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	if err := accountservices.RequireActiveAccount(account); err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	if command.Submission.SubmitForReview {
		if err := adsservices.RequirePayoutVerified(ctx, deployed.Verification, command.UserId.String()); err != nil {
			return dtos.CampaignDraftResult{}, err
		}
	}
	if err := validators.ValidateBundle(command.Submission, account.Currency, deployed.Pricing.FloorsForAudience(ctx, command.Submission.AdSet.Audience, account.Currency)); err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	if err := services.RequireUsableAccountReferences(ctx, deployed.Client, account.ID, command.Submission.AdSet, "adSet."); err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	for index, input := range command.Submission.Ads {
		if err := adsservices.VerifyCreativeOwnership(ctx, deployed.Ownership, adsservices.AdvertiserIdentity{OwnerUserId: account.OwnerUserID.String(), StoreId: account.StoreID}, input.Creative, fmt.Sprintf("ads.%d.creative", index)); err != nil {
			return dtos.CampaignDraftResult{}, err
		}
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var campaign *ent.AdCampaign
	var group *ent.AdGroup
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		created, err := services.ApplyCampaignInput(tx.AdCampaign.Create().SetAccountID(account.ID).SetCreatedByUserID(command.UserId), command.Submission.Campaign).Save(ctx)
		if err != nil {
			return err
		}
		campaign = created
		group, err = services.ApplyAdSetInput(tx.AdGroup.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID), command.Submission.AdSet).Save(ctx)
		if err != nil {
			return err
		}
		for _, input := range command.Submission.Ads {
			stored := services.ResolveCreative(input.Creative, account, deployed.Settings.MediaBaseUrl)
			if err := tx.Ad.Create().SetAccountID(account.ID).SetCampaignID(campaign.ID).SetAdGroupID(group.ID).SetName(input.Name).SetFormat(input.Creative.Format).SetCreative(stored).SetStatus(ad.StatusDraft).Exec(ctx); err != nil {
				return err
			}
		}
		if command.Submission.SubmitForReview {
			if _, err := services.SubmitAdsForReviewInTransaction(ctx, tx, campaign.ID, deployed.Now()); err != nil {
				return err
			}
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "campaign", campaign.ID.String(), actor, fmt.Sprintf("Created campaign %s", campaign.Name), nil)
	})
	if err != nil {
		return dtos.CampaignDraftResult{}, err
	}
	return handler.present(ctx, account, campaign.ID)
}

func (handler Handler) present(ctx context.Context, account *ent.AdAccount, campaignId uuid.UUID) (dtos.CampaignDraftResult, error) {
	return services.LoadBundle(ctx, services.Loader{Client: handler.Container.Client, Now: handler.Container.Now}, account, campaignId.String())
}

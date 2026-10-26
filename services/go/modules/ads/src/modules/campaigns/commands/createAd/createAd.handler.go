package createad

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/ad"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/modules/campaigns/services"
	"nantty/modules/ads/src/modules/campaigns/validators"
	adsservices "nantty/modules/ads/src/services"
	"nantty/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Ad, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.Ad{}, err
	}
	if err := accountservices.RequireActiveAccount(account); err != nil {
		return dtos.Ad{}, err
	}
	adSetId, err := uuid.Parse(command.Request.AdSetId)
	if err != nil {
		return dtos.Ad{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "adSetId", Message: "Choose an ad set."}})
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	group, err := loader.FindAdSet(ctx, account.ID, adSetId)
	if err != nil {
		return dtos.Ad{}, err
	}
	issues := validators.NewIssues("")
	if name := strings.TrimSpace(command.Request.Name); name == "" || len(name) > 120 {
		issues.Add("name", "Name the ad (up to 120 characters).")
	}
	validators.ValidateCreativeInput(command.Request.Creative, validators.EffectivePlacementsForAdSet(string(group.PlacementMode), group.Placements), issues, "creative")
	if err := issues.Error(); err != nil {
		return dtos.Ad{}, err
	}
	if err := adsservices.VerifyCreativeOwnership(ctx, deployed.Ownership, adsservices.AdvertiserIdentity{OwnerUserId: account.OwnerUserID.String(), StoreId: account.StoreID}, command.Request.Creative, "creative"); err != nil {
		return dtos.Ad{}, err
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	var row *ent.Ad
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		stored := services.ResolveCreative(command.Request.Creative, account, deployed.Settings.MediaBaseUrl)
		row, err = tx.Ad.Create().SetAccountID(account.ID).SetCampaignID(group.CampaignID).SetAdGroupID(group.ID).SetName(command.Request.Name).SetFormat(command.Request.Creative.Format).SetCreative(stored).SetStatus(ad.StatusDraft).Save(ctx)
		if err != nil {
			return err
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "ad", row.ID.String(), actor, "Created ad "+row.Name, nil)
	})
	if err != nil {
		return dtos.Ad{}, err
	}
	presented, err := loader.PresentAds(ctx, account, []*ent.Ad{row}, loader.Window(account, "", ""))
	return presented[0], err
}

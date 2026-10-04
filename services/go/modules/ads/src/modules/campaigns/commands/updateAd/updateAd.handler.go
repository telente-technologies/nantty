package updatead

import (
	"context"
	"strings"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/ad"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/modules/campaigns/services"
	"zudomart/modules/ads/src/modules/campaigns/validators"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.Ad, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, command.AccountId, command.UserId, adsservices.PermissionCampaignsManage)
	if err != nil {
		return dtos.Ad{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	row, err := loader.FindAd(ctx, account.ID, command.AdId)
	if err != nil {
		return dtos.Ad{}, err
	}
	group, err := loader.FindAdSet(ctx, account.ID, row.AdGroupID)
	if err != nil {
		return dtos.Ad{}, err
	}
	issues := validators.NewIssues("")
	if command.Patch.Name != nil {
		if name := strings.TrimSpace(*command.Patch.Name); name == "" || len(name) > 120 {
			issues.Add("name", "Name the ad (up to 120 characters).")
		}
	}
	if command.Patch.Creative != nil {
		validators.ValidateCreativeInput(*command.Patch.Creative, validators.EffectivePlacementsForAdSet(string(group.PlacementMode), group.Placements), issues, "creative")
	}
	if err := issues.Error(); err != nil {
		return dtos.Ad{}, err
	}
	if command.Patch.Creative != nil {
		if err := adsservices.VerifyCreativeOwnership(ctx, deployed.Ownership, adsservices.AdvertiserIdentity{OwnerUserId: account.OwnerUserID.String(), StoreId: account.StoreID}, *command.Patch.Creative, "creative"); err != nil {
			return dtos.Ad{}, err
		}
	}
	if command.Patch.Status != nil {
		if err := handler.checkStatusChange(account, row, *command.Patch.Status); err != nil {
			return dtos.Ad{}, err
		}
	}
	actor := accountservices.ActorFor(ctx, deployed, command.UserId)
	err = deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Ad.UpdateOneID(row.ID)
		if command.Patch.Name != nil {
			update.SetName(strings.TrimSpace(*command.Patch.Name))
		}
		if command.Patch.Status != nil {
			update.SetStatus(ad.Status(*command.Patch.Status))
		}
		if command.Patch.Creative != nil {
			update.SetCreative(services.ResolveCreative(*command.Patch.Creative, account, deployed.Settings.MediaBaseUrl)).SetFormat(command.Patch.Creative.Format)
			if row.Status != ad.StatusDraft {
				update.SetStatus(ad.StatusInReview).SetReviewStatus(ad.ReviewStatusPending).SetSubmittedAt(deployed.Now()).SetAutoCheckFlags(services.RunAutomatedPolicyChecks(*command.Patch.Creative)).ClearAppealStatus()
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if command.Patch.Creative != nil && row.Status != ad.StatusDraft {
			if err := services.RecomputeParentStatusesInTransaction(ctx, tx, row.CampaignID); err != nil {
				return err
			}
		}
		return adsservices.RecordActivityInTransaction(ctx, tx, account.ID, "ad", row.ID.String(), actor, "Updated ad "+row.Name, command.Patch)
	})
	if err != nil {
		return dtos.Ad{}, err
	}
	saved, err := loader.FindAd(ctx, account.ID, row.ID)
	if err != nil {
		return dtos.Ad{}, err
	}
	presented, err := loader.PresentAds(ctx, account, []*ent.Ad{saved}, loader.Window(account, "", ""))
	return presented[0], err
}

func (handler Handler) checkStatusChange(account *ent.AdAccount, row *ent.Ad, target string) error {
	if err := services.RequireStatusChangeAllowed(string(row.Status), target); err != nil {
		return err
	}
	if target == "active" && row.Status != ad.StatusActive {
		return services.RequireFundsToRun(account, handler.Container.Now())
	}
	return nil
}

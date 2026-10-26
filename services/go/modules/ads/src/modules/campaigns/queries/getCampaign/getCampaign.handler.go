package getcampaign

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/campaigns/dtos"
	"nantty/modules/ads/src/modules/campaigns/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.Campaign, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return dtos.Campaign{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	campaign, err := loader.FindCampaign(ctx, account.ID, query.CampaignId)
	if err != nil {
		return dtos.Campaign{}, err
	}
	presented, err := loader.PresentCampaigns(ctx, account, []*ent.AdCampaign{campaign}, loader.Window(account, query.From, query.To))
	if err != nil {
		return dtos.Campaign{}, err
	}
	return presented[0], nil
}

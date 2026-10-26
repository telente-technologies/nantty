package getadset

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

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.AdSet, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return dtos.AdSet{}, err
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	group, err := loader.FindAdSet(ctx, account.ID, query.AdSetId)
	if err != nil {
		return dtos.AdSet{}, err
	}
	presented, err := loader.PresentAdSets(ctx, account, []*ent.AdGroup{group}, loader.Window(account, query.From, query.To))
	if err != nil {
		return dtos.AdSet{}, err
	}
	return presented[0], nil
}

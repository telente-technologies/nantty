package listadsets

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adgroup"
	"zudomart/modules/ads/src/generated/ent/predicate"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/modules/campaigns/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.AdSet, string, int, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return nil, "", 0, err
	}
	filters := []predicate.AdGroup{adgroup.AccountID(account.ID)}
	if query.CampaignId != nil {
		filters = append(filters, adgroup.CampaignID(*query.CampaignId))
	}
	total, err := deployed.Client.AdGroup.Query().Where(filters...).Count(ctx)
	if err != nil {
		return nil, "", 0, err
	}
	if query.Cursor != nil {
		filters = append(filters, adgroup.IDLT(*query.Cursor))
	}
	rows, err := deployed.Client.AdGroup.Query().Where(filters...).Order(adgroup.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", 0, err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	presented, err := loader.PresentAdSets(ctx, account, rows, loader.Window(account, query.From, query.To))
	return presented, next, total, err
}

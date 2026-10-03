package listcampaigns

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adcampaign"
	"zudomart/modules/ads/src/generated/ent/predicate"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/modules/campaigns/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.Campaign, string, int, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return nil, "", 0, err
	}
	filters := []predicate.AdCampaign{adcampaign.AccountID(account.ID)}
	if query.Status != "" {
		filters = append(filters, adcampaign.StatusEQ(adcampaign.Status(query.Status)))
	}
	if query.Objective != "" {
		filters = append(filters, adcampaign.ObjectiveEQ(adcampaign.Objective(query.Objective)))
	}
	if query.Search != "" {
		filters = append(filters, adcampaign.NameContainsFold(query.Search))
	}
	total, err := deployed.Client.AdCampaign.Query().Where(filters...).Count(ctx)
	if err != nil {
		return nil, "", 0, err
	}
	if query.Cursor != nil {
		filters = append(filters, adcampaign.IDLT(*query.Cursor))
	}
	rows, err := deployed.Client.AdCampaign.Query().Where(filters...).Order(adcampaign.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", 0, err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	loader := services.Loader{Client: deployed.Client, Now: deployed.Now}
	presented, err := loader.PresentCampaigns(ctx, account, rows, loader.Window(account, query.From, query.To))
	return presented, next, total, err
}

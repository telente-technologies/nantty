package listaudiences

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adcustomaudience"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/audiences/dtos"
	"nantty/modules/ads/src/modules/audiences/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/utils"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.CustomAudience, string, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView); err != nil {
		return nil, "", err
	}
	request := deployed.Client.AdCustomAudience.Query().Where(adcustomaudience.AccountID(query.AccountId))
	if query.Type != "" {
		request.Where(adcustomaudience.TypeEQ(adcustomaudience.Type(query.Type)))
	}
	if query.Cursor != nil {
		request.Where(adcustomaudience.IDLT(*query.Cursor))
	}
	rows, err := request.Order(adcustomaudience.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	items := make([]dtos.CustomAudience, 0, len(rows))
	for _, row := range rows {
		items = append(items, services.PresentAudience(row, services.CountAdSetsUsing(ctx, deployed, query.AccountId, row.ID)))
	}
	return items, next, nil
}

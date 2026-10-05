package listconversionevents

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adconversionevent"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/tools/dtos"
	"zudomart/modules/ads/src/modules/tools/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.ConversionEvent, string, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return nil, "", err
	}
	if err := services.EnsureBuiltInPurchaseEvent(ctx, deployed, account); err != nil {
		return nil, "", err
	}
	request := deployed.Client.AdConversionEvent.Query().Where(adconversionevent.AccountID(account.ID))
	if query.Cursor != nil {
		request.Where(adconversionevent.IDLT(*query.Cursor))
	}
	rows, err := request.Order(adconversionevent.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	items := make([]dtos.ConversionEvent, 0, len(rows))
	for _, row := range rows {
		items = append(items, services.PresentConversionEvent(row, services.ReadConversionActivity(ctx, deployed.Client, row, deployed.Now())))
	}
	return items, next, nil
}

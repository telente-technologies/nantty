package listconversionevents

import (
	"context"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adconversionevent"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/tools/dtos"
	"nantty/modules/ads/src/modules/tools/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/utils"
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

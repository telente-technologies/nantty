package listexperiments

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adexperiment"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/tools/dtos"
	"zudomart/modules/ads/src/modules/tools/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
)

type Query struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Cursor    *uuid.UUID
	Limit     int
}

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.Experiment, string, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView); err != nil {
		return nil, "", err
	}
	request := deployed.Client.AdExperiment.Query().Where(adexperiment.AccountID(query.AccountId))
	if query.Cursor != nil {
		request.Where(adexperiment.IDLT(*query.Cursor))
	}
	rows, err := request.Order(adexperiment.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	items, err := services.PresentExperiments(ctx, deployed.Client, rows)
	return items, next, err
}

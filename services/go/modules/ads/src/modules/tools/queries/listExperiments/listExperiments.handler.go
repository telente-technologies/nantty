package listexperiments

import (
	"context"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adexperiment"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/tools/dtos"
	"nantty/modules/ads/src/modules/tools/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/utils"
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

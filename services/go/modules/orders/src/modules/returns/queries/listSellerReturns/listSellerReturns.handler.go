package listsellerreturns

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/predicate"
	"zudomart/modules/orders/src/generated/ent/returnrequest"
	"zudomart/modules/orders/src/modules/returns/dtos"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.ReturnView], error) {
	empty := httpserver.CursorPage[dtos.ReturnView]{}
	conditions := []predicate.ReturnRequest{}
	if query.StoreId != nil {
		conditions = append(conditions, returnrequest.StoreID(*query.StoreId))
	}
	if query.BuyerId != nil {
		conditions = append(conditions, returnrequest.BuyerAccountID(*query.BuyerId))
	}
	if query.Status != "" && query.Status != "all" {
		conditions = append(conditions, returnrequest.Status(query.Status))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, returnrequest.IDLT(*after))
	}
	rows, err := handler.Container.Client.ReturnRequest.Query().Where(conditions...).Order(ent.Desc(returnrequest.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	visible, nextCursor := rows, ""
	if len(rows) > query.Limit {
		visible = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(visible[len(visible)-1].ID)
	}
	views, err := services.ReturnViews(ctx, handler.Container, visible)
	return httpserver.NewCursorPage(views, nextCursor), err
}

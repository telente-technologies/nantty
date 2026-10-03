package listmyorders

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/predicate"
	"zudomart/modules/orders/src/services"
	"zudomart/modules/orders/src/types"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

var statusesByBuyerFilter = map[string][]string{
	"pending":   {enums.StatusPending},
	"paid":      {enums.StatusNew, enums.StatusProcessing, enums.StatusReady},
	"shipped":   {enums.StatusShipped},
	"delivered": {enums.StatusDelivered},
	"completed": {enums.StatusCompleted},
	"cancelled": {enums.StatusCancelled, enums.StatusRefunded, enums.StatusReturned},
	"disputed":  {enums.StatusDisputed},
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.OrderView], error) {
	empty := httpserver.CursorPage[types.OrderView]{}
	conditions := []predicate.OrderGroup{ordergroup.BuyerAccountID(query.BuyerId)}
	if query.Status != "" {
		statuses, known := statusesByBuyerFilter[query.Status]
		if !known {
			return empty, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "unknown status"}})
		}
		conditions = append(conditions, ordergroup.StatusIn(statuses...))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, ordergroup.IDLT(*after))
	}
	rows, err := handler.Container.Client.OrderGroup.Query().Where(conditions...).Order(ent.Desc(ordergroup.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	visible, nextCursor := rows, ""
	if len(rows) > query.Limit {
		visible = rows[:query.Limit]
		nextCursor = utils.IdentifierCursor(visible[len(visible)-1].ID)
	}
	views, err := services.BuyerOrderViews(ctx, handler.Container, visible)
	return httpserver.NewCursorPage(views, nextCursor), err
}

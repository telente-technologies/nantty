package listadminorders

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/predicate"
	"nantty/modules/orders/src/modules/adminOrders/dtos"
	"nantty/modules/orders/src/modules/adminOrders/services"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.OrderSummary], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[dtos.OrderSummary]{}, err
	}
	conditions := []predicate.OrderGroup{}
	if query.Status != "" {
		conditions = append(conditions, ordergroup.Status(query.Status))
	}
	if query.Currency != "" {
		conditions = append(conditions, ordergroup.Currency(query.Currency))
	}
	if query.StoreId != nil {
		conditions = append(conditions, ordergroup.StoreID(*query.StoreId))
	}
	if text := strings.TrimSpace(query.Text); text != "" {
		conditions = append(conditions, searchCondition(text))
	}
	if after != nil {
		conditions = append(conditions, ordergroup.IDLT(*after))
	}
	groups, err := handler.Container.Client.OrderGroup.Query().Where(conditions...).Order(ent.Desc(ordergroup.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.OrderSummary]{}, err
	}
	nextCursor := ""
	if len(groups) > query.Limit {
		groups = groups[:query.Limit]
		nextCursor = utils.IdentifierCursor(groups[len(groups)-1].ID)
	}
	summaries, err := services.Summaries(ctx, handler.Container, groups)
	if err != nil {
		return httpserver.CursorPage[dtos.OrderSummary]{}, err
	}
	return httpserver.NewCursorPage(summaries, nextCursor), nil
}

func searchCondition(text string) predicate.OrderGroup {
	if identifier, err := uuid.Parse(text); err == nil {
		return ordergroup.Or(ordergroup.ID(identifier), ordergroup.BuyerAccountID(identifier), ordergroup.SellerAccountID(identifier), ordergroup.StoreID(identifier), ordergroup.CheckoutID(identifier))
	}
	return ordergroup.Or(ordergroup.ReferenceEqualFold(text), ordergroup.InvoiceNumberEqualFold(text), ordergroup.BuyerUsernameContainsFold(text), ordergroup.BuyerNameContainsFold(text))
}

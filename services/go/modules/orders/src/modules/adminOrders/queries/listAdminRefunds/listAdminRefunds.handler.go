package listadminrefunds

import (
	"context"
	"strings"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/predicate"
	"zudomart/modules/orders/src/generated/ent/refundrecord"
	"zudomart/modules/orders/src/modules/adminOrders/dtos"
	"zudomart/modules/orders/src/modules/adminOrders/services"
	"zudomart/modules/orders/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[dtos.RefundRecord], error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return httpserver.CursorPage[dtos.RefundRecord]{}, err
	}
	conditions := []predicate.RefundRecord{}
	if query.Source != "" {
		conditions = append(conditions, refundrecord.Source(query.Source))
	}
	if query.Status != "" {
		conditions = append(conditions, refundrecord.Status(query.Status))
	}
	if query.OrderId != nil {
		conditions = append(conditions, refundrecord.OrderGroupID(*query.OrderId))
	}
	if text := strings.TrimSpace(query.Text); text != "" {
		conditions = append(conditions, refundrecord.Or(refundrecord.OrderReferenceEqualFold(text), refundrecord.CreatedByNameContainsFold(text), refundrecord.ReasonContainsFold(text)))
	}
	if after != nil {
		conditions = append(conditions, refundrecord.IDLT(*after))
	}
	records, err := handler.Container.Client.RefundRecord.Query().Where(conditions...).Order(ent.Desc(refundrecord.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.RefundRecord]{}, err
	}
	nextCursor := ""
	if len(records) > query.Limit {
		records = records[:query.Limit]
		nextCursor = utils.IdentifierCursor(records[len(records)-1].ID)
	}
	return httpserver.NewCursorPage(services.RefundViews(ctx, handler.Container, records), nextCursor), nil
}

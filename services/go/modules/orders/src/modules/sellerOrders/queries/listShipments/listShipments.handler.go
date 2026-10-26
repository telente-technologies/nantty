package listshipments

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/orderitem"
	"nantty/modules/orders/src/generated/ent/predicate"
	listsellerorders "nantty/modules/orders/src/modules/sellerOrders/queries/listSellerOrders"
	"nantty/modules/orders/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

type ShipmentView struct {
	OrderId             string      `json:"orderId"`
	OrderNumber         string      `json:"orderNumber"`
	BuyerName           string      `json:"buyerName"`
	BuyerUsername       string      `json:"buyerUsername"`
	City                string      `json:"city"`
	State               string      `json:"state"`
	Status              string      `json:"status"`
	Courier             *string     `json:"courier"`
	TrackingNumber      *string     `json:"trackingNumber"`
	RiderName           *string     `json:"riderName"`
	RiderPhone          *string     `json:"riderPhone"`
	EstimatedDeliveryAt *time.Time  `json:"estimatedDeliveryAt"`
	Attempts            int         `json:"attempts"`
	LastAttemptNote     *string     `json:"lastAttemptNote"`
	DeliveryFee         money.Money `json:"deliveryFee"`
	ItemsCount          int         `json:"itemsCount"`
	OrderedAt           time.Time   `json:"orderedAt"`
	UpdatedAt           time.Time   `json:"updatedAt"`
}

var PipelineStatuses = []string{"pending", "preparing", "ready_for_pickup", "in_transit", "delivered", "failed"}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[ShipmentView], error) {
	empty := httpserver.CursorPage[ShipmentView]{}
	conditions := []predicate.OrderGroup{listsellerorders.PaidOrdersOfStore(query.StoreId)}
	switch {
	case query.Status == "" || query.Status == "all":
		conditions = append(conditions, ordergroup.DeliveryStatusNotIn("cancelled", "returned"))
	case slices.Contains(PipelineStatuses, query.Status):
		conditions = append(conditions, ordergroup.DeliveryStatus(query.Status))
	default:
		return empty, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "unknown delivery status"}})
	}
	if query.Text != "" {
		conditions = append(conditions, ordergroup.Or(ordergroup.ReferenceContainsFold(query.Text), ordergroup.BuyerNameContainsFold(query.Text),
			ordergroup.BuyerUsernameContainsFold(query.Text), ordergroup.TrackingNumberContainsFold(query.Text), ordergroup.RiderNameContainsFold(query.Text)))
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
	counts, err := handler.itemCounts(ctx, rows)
	if err != nil {
		return empty, err
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit, func(row *ent.OrderGroup) ShipmentView {
		address := row.Address
		city := address.CityName
		if city == "" {
			city = address.AdminAreaName
		}
		return ShipmentView{
			OrderId: row.ID.String(), OrderNumber: row.Reference, BuyerName: row.BuyerName, BuyerUsername: row.BuyerUsername, City: city, State: address.RegionName,
			Status: row.DeliveryStatus, Courier: row.CourierName, TrackingNumber: row.TrackingNumber, RiderName: row.RiderName, RiderPhone: row.RiderPhone,
			EstimatedDeliveryAt: row.EstimatedDeliveryAt, Attempts: row.DeliveryAttempts, LastAttemptNote: row.LastAttemptNote,
			DeliveryFee: money.Money{AmountMinor: row.ShippingMinor, Currency: money.CurrencyCode(row.Currency)}, ItemsCount: counts[row.ID], OrderedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		}
	}, func(row *ent.OrderGroup) string { return utils.IdentifierCursor(row.ID) }), nil
}

func (handler Handler) itemCounts(ctx context.Context, rows []*ent.OrderGroup) (map[uuid.UUID]int, error) {
	ids := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	items, err := handler.Container.Client.OrderItem.Query().Where(orderitem.OrderGroupIDIn(ids...)).Select(orderitem.FieldOrderGroupID, orderitem.FieldQuantity).All(ctx)
	if err != nil {
		return nil, err
	}
	counts := map[uuid.UUID]int{}
	for _, item := range items {
		counts[item.OrderGroupID] += item.Quantity
	}
	return counts, nil
}

package listadminlogistics

import (
	"context"
	"net/url"
	"regexp"
	"strings"
	"time"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/deliveryclaim"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/generated/ent/shipment"
	"nantty/modules/orders/src/utils"
)

var shipmentStatuses = map[string]struct{}{
	"pending": {}, "quoted": {}, "booked": {}, "picked_up": {}, "in_transit": {},
	"delivered": {}, "cancelled": {}, "failed": {},
}

var trackingNumberPattern = regexp.MustCompile(`^[A-Za-z0-9-]{4,40}$`)

func ValidShipmentStatus(status string) bool {
	_, ok := shipmentStatuses[status]
	return ok
}

type Exception struct {
	Reason string `json:"reason"`
	Status string `json:"status"`
}

type ShipmentSummary struct {
	ShipmentID     string     `json:"shipmentId"`
	OrderID        string     `json:"orderId"`
	StoreID        string     `json:"storeId"`
	Reference      string     `json:"reference"`
	Provider       string     `json:"provider"`
	Status         string     `json:"status"`
	TrackingNumber *string    `json:"trackingNumber"`
	TrackingURL    *string    `json:"trackingUrl"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	Exception      *Exception `json:"exception"`
}

type Page struct {
	Items      []ShipmentSummary `json:"items"`
	NextCursor string            `json:"nextCursor"`
}

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return Page{}, err
	}
	groupQuery := handler.Container.Client.OrderGroup.Query().Where(ordergroup.ShippedAtNotNil())
	if query.Status != "" {
		switch query.Status {
		case "in_transit":
			groupQuery = groupQuery.Where(ordergroup.Or(ordergroup.Status("shipped"), ordergroup.DeliveryStatus("in_transit")))
		case "delivered", "cancelled":
			groupQuery = groupQuery.Where(ordergroup.Or(ordergroup.Status(query.Status), ordergroup.DeliveryStatus(query.Status)))
		case "pending":
			groupQuery = groupQuery.Where(ordergroup.And(ordergroup.DeliveryStatus(query.Status), ordergroup.StatusNEQ("shipped")))
		default:
			groupQuery = groupQuery.Where(ordergroup.DeliveryStatus(query.Status))
		}
	}
	if after != nil {
		groupQuery = groupQuery.Where(ordergroup.IDLT(*after))
	}
	groups, err := groupQuery.Select(
		ordergroup.FieldID, ordergroup.FieldStoreID, ordergroup.FieldReference,
		ordergroup.FieldStatus, ordergroup.FieldDeliveryStatus, ordergroup.FieldCourierName,
		ordergroup.FieldTrackingNumber, ordergroup.FieldTrackingURL, ordergroup.FieldShippedAt,
		ordergroup.FieldCreatedAt, ordergroup.FieldUpdatedAt,
	).Order(ent.Desc(ordergroup.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return Page{}, err
	}
	nextCursor := ""
	if len(groups) > query.Limit {
		groups = groups[:query.Limit]
		nextCursor = utils.IdentifierCursor(groups[len(groups)-1].ID)
	}
	if len(groups) == 0 {
		return Page{Items: []ShipmentSummary{}, NextCursor: nextCursor}, nil
	}
	items := make([]ShipmentSummary, 0, len(groups))
	for _, group := range groups {
		status := group.Status
		if group.DeliveryStatus != "" && group.DeliveryStatus != "pending" && ValidShipmentStatus(group.DeliveryStatus) {
			status = group.DeliveryStatus
		} else if status == "shipped" {
			status = "in_transit"
		}
		provider := "seller-managed"
		if group.CourierName != nil && strings.TrimSpace(*group.CourierName) != "" {
			provider = strings.TrimSpace(*group.CourierName)
		}
		item := ShipmentSummary{
			ShipmentID: group.ID.String(), OrderID: group.ID.String(), StoreID: group.StoreID.String(),
			Reference: group.Reference, Provider: provider, Status: status,
			CreatedAt: group.CreatedAt.UTC(), UpdatedAt: group.UpdatedAt.UTC(),
			TrackingNumber: SafeTrackingNumber(group.TrackingNumber), TrackingURL: SafeTrackingURL(group.TrackingURL),
		}
		shipmentRow, shipmentErr := handler.Container.Client.Shipment.Query().Where(shipment.OrderGroupID(group.ID)).Select(
			shipment.FieldID, shipment.FieldProvider, shipment.FieldStatus, shipment.FieldCreatedAt,
			shipment.FieldUpdatedAt, shipment.FieldTrackingNumber, shipment.FieldTrackingURL,
		).First(ctx)
		if shipmentErr != nil && !ent.IsNotFound(shipmentErr) {
			return Page{}, shipmentErr
		}
		if shipmentErr == nil {
			item.ShipmentID = shipmentRow.ID.String()
			item.Provider = shipmentRow.Provider
			item.Status = shipmentRow.Status
			item.CreatedAt = shipmentRow.CreatedAt.UTC()
			item.UpdatedAt = shipmentRow.UpdatedAt.UTC()
			if shipmentRow.TrackingNumber != nil {
				item.TrackingNumber = SafeTrackingNumber(shipmentRow.TrackingNumber)
			}
			if shipmentRow.TrackingURL != nil {
				item.TrackingURL = SafeTrackingURL(shipmentRow.TrackingURL)
			}
			claim, claimErr := handler.Container.Client.DeliveryClaim.Query().Where(deliveryclaim.ShipmentID(shipmentRow.ID)).
				Select(deliveryclaim.FieldKind, deliveryclaim.FieldStatus).Order(ent.Desc(deliveryclaim.FieldOpenedAt)).First(ctx)
			if claimErr != nil && !ent.IsNotFound(claimErr) {
				return Page{}, claimErr
			}
			if claimErr == nil {
				item.Exception = &Exception{Reason: SafeClaimKind(claim.Kind), Status: SafeClaimStatus(claim.Status)}
			}
		}
		if item.Exception == nil && group.DeliveryStatus == "failed" {
			item.Exception = &Exception{Reason: "failed_delivery", Status: "open"}
		}
		items = append(items, item)
	}
	return Page{Items: items, NextCursor: nextCursor}, nil
}

func SafeTrackingNumber(value *string) *string {
	if value == nil || !trackingNumberPattern.MatchString(*value) {
		return nil
	}
	return value
}

func SafeTrackingURL(value *string) *string {
	if value == nil || len(*value) > 300 || strings.TrimSpace(*value) != *value {
		return nil
	}
	parsed, err := url.Parse(*value)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return nil
	}
	return value
}

func SafeClaimKind(kind string) string {
	switch kind {
	case "loss", "damage", "delay", "failed_delivery", "not_received", "wrong_item":
		return kind
	default:
		return "other"
	}
}

func SafeClaimStatus(status string) string {
	switch status {
	case "open", "reviewing", "approved", "rejected", "resolved", "closed":
		return status
	default:
		return "other"
	}
}

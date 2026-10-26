package listactiveorders

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/ordergroup"
	"nantty/modules/orders/src/modules/widgets/dtos"
	widgetservices "nantty/modules/orders/src/modules/widgets/services"
	"nantty/modules/orders/src/services"
	"nantty/platform/widgets"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.OrderWidgetPayload, error) {
	active := handler.Container.Client.OrderGroup.Query().Where(ordergroup.BuyerAccountID(query.BuyerId), ordergroup.StatusIn(widgetservices.ActiveOrderStatuses...))
	count, err := active.Clone().Count(ctx)
	if err != nil {
		return dtos.OrderWidgetPayload{}, err
	}
	groups, err := active.Order(ent.Desc(ordergroup.FieldUpdatedAt)).Limit(query.Limit).All(ctx)
	if err != nil {
		return dtos.OrderWidgetPayload{}, err
	}
	payload := dtos.OrderWidgetPayload{Orders: []dtos.OrderWidgetItem{}, ActiveCount: count, GeneratedAt: handler.Container.Now().UTC().Format(time.RFC3339)}
	if len(groups) == 0 {
		return payload, nil
	}
	items, err := services.LoadItemsByGroup(ctx, handler.Container, services.UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.ID }))
	if err != nil {
		return dtos.OrderWidgetPayload{}, err
	}
	storeNames := handler.storeNames(ctx, groups)
	for _, group := range groups {
		payload.Orders = append(payload.Orders, orderWidgetItem(group, items[group.ID], storeNames[group.StoreID]))
	}
	return payload, nil
}

func (handler Handler) storeNames(ctx context.Context, groups []*ent.OrderGroup) map[uuid.UUID]string {
	names := map[uuid.UUID]string{}
	catalog, err := handler.Container.Catalog()
	if err != nil {
		return names
	}
	stores, err := catalog.DescribeStores(ctx, services.UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.StoreID }))
	if err != nil {
		return names
	}
	for storeId, store := range stores {
		names[storeId] = store.Name
	}
	return names
}

func orderWidgetItem(group *ent.OrderGroup, items []*ent.OrderItem, storeName string) dtos.OrderWidgetItem {
	status := widgetservices.OrderWidgetStatusFor(group.Status, group.DeliveryStatus, group.RiderName != nil && *group.RiderName != "")
	item := dtos.OrderWidgetItem{
		Id: group.ID.String(), Reference: group.Reference, Status: status.Key, StatusLabel: status.Label,
		EtaAt: widgets.FormatWidgetTime(group.EstimatedDeliveryAt), StoreName: storeName,
		DeepLink: widgetservices.OrderDeepLink(group.ID.String()), UpdatedAt: group.UpdatedAt.UTC().Format(time.RFC3339),
	}
	for _, line := range items {
		item.ItemCount += line.Quantity
		if item.ItemTitle == "" {
			item.ItemTitle = line.ProductName
			item.ImageUrl = line.ImageURL
		}
	}
	return item
}

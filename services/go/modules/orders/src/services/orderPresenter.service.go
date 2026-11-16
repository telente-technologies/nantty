package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/orderevent"
	"nantty/modules/orders/src/generated/ent/orderitem"
	"nantty/modules/orders/src/types"
	"nantty/platform/money"
)

func LoadItemsByGroup(ctx context.Context, deployed *container.Container, groupIds []uuid.UUID) (map[uuid.UUID][]*ent.OrderItem, error) {
	items, err := deployed.Client.OrderItem.Query().Where(orderitem.OrderGroupIDIn(groupIds...)).Order(ent.Asc(orderitem.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	byGroup := map[uuid.UUID][]*ent.OrderItem{}
	for _, item := range items {
		byGroup[item.OrderGroupID] = append(byGroup[item.OrderGroupID], item)
	}
	return byGroup, nil
}

func orderItemView(item *ent.OrderItem, currency string) types.CartItemView {
	price := money.Money{AmountMinor: item.UnitPriceMinor, Currency: money.CurrencyCode(currency)}
	summary := types.ProductSummaryView{Id: item.ProductID.String(), Name: item.ProductName, Price: price, ImageUrl: item.ImageURL}
	view := types.CartItemView{Id: item.ID.String(), Product: summary, Quantity: item.Quantity, StoreId: item.StoreID.String(), Available: true,
		VariantDetail: &types.CartVariantView{Id: item.VariantID.String(), Size: item.Size, Color: item.Color, Sku: item.Sku, Title: item.VariantTitle}}
	if item.VariantTitle != "" && item.VariantTitle != "Default" {
		title := item.VariantTitle
		view.Variant = &title
	}
	if item.AttributionSource != nil && item.AttributionID != nil {
		view.Attribution = &types.SaleAttributionView{Source: *item.AttributionSource, Id: item.AttributionID.String()}
	}
	return view
}

func BuyerOrderViews(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup) ([]types.OrderView, error) {
	return buyerOrderViews(ctx, deployed, groups, false)
}

func BuyerOrderViewsWithTimeline(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup) ([]types.OrderView, error) {
	return buyerOrderViews(ctx, deployed, groups, true)
}

func buyerOrderViews(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup, includeTimeline bool) ([]types.OrderView, error) {
	if len(groups) == 0 {
		return []types.OrderView{}, nil
	}
	groupIds := make([]uuid.UUID, 0, len(groups))
	for _, group := range groups {
		groupIds = append(groupIds, group.ID)
	}
	items, err := LoadItemsByGroup(ctx, deployed, groupIds)
	if err != nil {
		return nil, err
	}
	eventsByGroup := make(map[uuid.UUID][]*ent.OrderEvent, len(groups))
	if includeTimeline {
		events, err := deployed.Client.OrderEvent.Query().Where(orderevent.OrderGroupIDIn(groupIds...)).Order(ent.Asc(orderevent.FieldCreatedAt)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, event := range events {
			eventsByGroup[event.OrderGroupID] = append(eventsByGroup[event.OrderGroupID], event)
		}
	}
	catalog, err := deployed.Catalog()
	if err != nil {
		return nil, err
	}
	stores, err := catalog.DescribeStores(ctx, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.StoreID }))
	if err != nil {
		return nil, err
	}
	rates, _ := StoreSuccessRates(ctx, deployed, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.StoreID }))
	profiles, _ := deployed.Users.PersonalProfilesByAccount(ctx, UniqueIdentifiers(groups, func(group *ent.OrderGroup) uuid.UUID { return group.BuyerAccountID }))
	views := make([]types.OrderView, 0, len(groups))
	for _, group := range groups {
		views = append(views, BuildBuyerOrderView(group, items[group.ID], stores[group.StoreID], profiles[group.BuyerAccountID], successRateOf(rates, group.StoreID), eventsByGroup[group.ID]))
	}
	return views, nil
}

func UniqueIdentifiers[Row any](rows []Row, identifierOf func(Row) uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]bool{}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifier := identifierOf(row)
		if !seen[identifier] {
			seen[identifier] = true
			identifiers = append(identifiers, identifier)
		}
	}
	return identifiers
}

func successRateOf(rates map[uuid.UUID]float64, storeId uuid.UUID) *float64 {
	if rate, found := rates[storeId]; found {
		return &rate
	}
	return nil
}

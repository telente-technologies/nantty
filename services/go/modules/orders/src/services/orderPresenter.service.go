package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/orderitem"
	"zudomart/modules/orders/src/types"
	"zudomart/platform/money"
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
	return view
}

func BuyerOrderViews(ctx context.Context, deployed *container.Container, groups []*ent.OrderGroup) ([]types.OrderView, error) {
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
		views = append(views, buyerOrderView(group, items[group.ID], stores[group.StoreID], profiles[group.BuyerAccountID], successRateOf(rates, group.StoreID)))
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

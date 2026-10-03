package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/orderitem"
	"zudomart/modules/orders/src/modules/returns/dtos"
	"zudomart/platform/money"
)

func ReturnViews(ctx context.Context, deployed *container.Container, rows []*ent.ReturnRequest) ([]dtos.ReturnView, error) {
	groupIds := UniqueIdentifiers(rows, func(row *ent.ReturnRequest) uuid.UUID { return row.OrderGroupID })
	groups, err := deployed.Client.OrderGroup.Query().Where(ordergroup.IDIn(groupIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	byGroup := map[uuid.UUID]*ent.OrderGroup{}
	for _, group := range groups {
		byGroup[group.ID] = group
	}
	items, err := deployed.Client.OrderItem.Query().Where(orderitem.OrderGroupIDIn(groupIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	names := map[string]string{}
	for _, item := range items {
		names[item.ID.String()] = item.ProductName
	}
	views := make([]dtos.ReturnView, 0, len(rows))
	for _, row := range rows {
		view := dtos.ReturnView{
			Id: row.ID.String(), OrderId: row.OrderGroupID.String(), OrderNumber: byGroup[row.OrderGroupID].Reference, BuyerName: byGroup[row.OrderGroupID].BuyerName, Reason: row.Reason,
			Status: row.Status, DeclineNote: row.DeclineNote, RefundAmount: money.Money{AmountMinor: row.RefundAmountMinor, Currency: money.CurrencyCode(row.Currency)},
			CreatedAt: row.CreatedAt, Lines: []dtos.ReturnLineView{},
		}
		for _, line := range row.Lines {
			view.Lines = append(view.Lines, dtos.ReturnLineView{OrderLineId: line.OrderItemId, Name: names[line.OrderItemId], Quantity: line.Quantity})
		}
		views = append(views, view)
	}
	return views, nil
}

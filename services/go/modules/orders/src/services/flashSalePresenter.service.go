package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/flashsaleitem"
	"zudomart/modules/orders/src/modules/marketingCampaigns/dtos"
	"zudomart/platform/money"
)

func FlashSaleStatus(sale *ent.FlashSale, now time.Time) string {
	switch {
	case sale.EndedAt != nil || !sale.EndsAt.After(now):
		return "ended"
	case sale.Paused:
		return "paused"
	case sale.StartsAt.After(now):
		return "scheduled"
	}
	return "active"
}

func PresentFlashSales(ctx context.Context, deployed *container.Container, sales []*ent.FlashSale) ([]dtos.FlashSaleView, error) {
	views := make([]dtos.FlashSaleView, 0, len(sales))
	if len(sales) == 0 {
		return views, nil
	}
	saleIds := make([]uuid.UUID, 0, len(sales))
	for _, sale := range sales {
		saleIds = append(saleIds, sale.ID)
	}
	items, err := deployed.Client.FlashSaleItem.Query().Where(flashsaleitem.FlashSaleIDIn(saleIds...)).Order(ent.Asc(flashsaleitem.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	itemsBySale, productIds := map[uuid.UUID][]*ent.FlashSaleItem{}, []uuid.UUID{}
	for _, item := range items {
		itemsBySale[item.FlashSaleID] = append(itemsBySale[item.FlashSaleID], item)
		productIds = append(productIds, item.ProductID)
	}
	products, err := LoadCampaignProducts(ctx, deployed, sales[0].StoreID, productIds)
	if err != nil {
		return nil, err
	}
	now := deployed.Now()
	for _, sale := range sales {
		currency := money.CurrencyCode(sale.Currency)
		view := dtos.FlashSaleView{Id: sale.ID.String(), Name: sale.Name, Items: []dtos.FlashSaleItemView{}, StartsAt: sale.StartsAt, EndsAt: sale.EndsAt, Status: FlashSaleStatus(sale, now),
			Reach: sale.Reach, Revenue: money.Money{AmountMinor: sale.RevenueMinor, Currency: currency}, CreatedAt: sale.CreatedAt}
		for _, item := range itemsBySale[sale.ID] {
			product := products[item.ProductID]
			view.Items = append(view.Items, dtos.FlashSaleItemView{ProductId: item.ProductID.String(), ProductName: product.Name, ImageUrl: product.ImageUrl,
				OriginalPrice: money.Money{AmountMinor: item.OriginalPriceMinor, Currency: currency}, SalePrice: money.Money{AmountMinor: item.SalePriceMinor, Currency: currency}, StockCap: item.StockCap, SoldCount: item.SoldCount})
		}
		views = append(views, view)
	}
	return views, nil
}

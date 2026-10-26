package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/productbundleitem"
	"nantty/modules/orders/src/modules/marketingCampaigns/dtos"
	"nantty/platform/money"
)

func PresentProductBundles(ctx context.Context, deployed *container.Container, bundles []*ent.ProductBundle) ([]dtos.ProductBundleView, error) {
	views := make([]dtos.ProductBundleView, 0, len(bundles))
	if len(bundles) == 0 {
		return views, nil
	}
	bundleIds := make([]uuid.UUID, 0, len(bundles))
	for _, bundle := range bundles {
		bundleIds = append(bundleIds, bundle.ID)
	}
	items, err := deployed.Client.ProductBundleItem.Query().Where(productbundleitem.BundleIDIn(bundleIds...)).Order(ent.Asc(productbundleitem.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	itemsByBundle, productIds := map[uuid.UUID][]*ent.ProductBundleItem{}, []uuid.UUID{}
	for _, item := range items {
		itemsByBundle[item.BundleID] = append(itemsByBundle[item.BundleID], item)
		productIds = append(productIds, item.ProductID)
	}
	products, err := LoadCampaignProducts(ctx, deployed, bundles[0].StoreID, productIds)
	if err != nil {
		return nil, err
	}
	for _, bundle := range bundles {
		currency := money.CurrencyCode(bundle.Currency)
		view := dtos.ProductBundleView{Id: bundle.ID.String(), Name: bundle.Name, Description: bundle.Description, Items: []dtos.BundleItemView{}, BundlePrice: money.Money{AmountMinor: bundle.BundlePriceMinor, Currency: currency},
			Status: bundle.Status, SoldCount: bundle.SoldCount, Revenue: money.Money{AmountMinor: bundle.RevenueMinor, Currency: currency}, CreatedAt: bundle.CreatedAt}
		var regular int64
		for _, item := range itemsByBundle[bundle.ID] {
			product := products[item.ProductID]
			regular += product.RegularPriceMinor * int64(item.Quantity)
			view.Items = append(view.Items, dtos.BundleItemView{ProductId: item.ProductID.String(), ProductName: product.Name, ImageUrl: product.ImageUrl, Quantity: item.Quantity, UnitPrice: money.Money{AmountMinor: product.RegularPriceMinor, Currency: currency}})
		}
		view.RegularPrice = money.Money{AmountMinor: regular, Currency: currency}
		views = append(views, view)
	}
	return views, nil
}

package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/featuredproduct"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/modules/catalog/src/modules/featuredProducts/dtos"
	"zudomart/platform/money"
)

func ListFeaturedProductViews(ctx context.Context, deployed *container.Container, storeId uuid.UUID) ([]dtos.FeaturedProductView, error) {
	rows, err := deployed.Client.FeaturedProduct.Query().Where(featuredproduct.StoreID(storeId)).Order(ent.Asc(featuredproduct.FieldPosition)).All(ctx)
	if err != nil || len(rows) == 0 {
		return []dtos.FeaturedProductView{}, err
	}
	productIds := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		productIds = append(productIds, row.ProductID)
	}
	products, err := deployed.Client.Product.Query().Where(product.IDIn(productIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	productsById := map[uuid.UUID]*ent.Product{}
	for _, row := range products {
		productsById[row.ID] = row
	}
	media, err := deployed.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(productIds...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	firstImage := map[uuid.UUID]*string{}
	for _, item := range media {
		if _, taken := firstImage[item.ProductID]; !taken {
			firstImage[item.ProductID] = &item.URL
		}
	}
	views := make([]dtos.FeaturedProductView, 0, len(rows))
	for _, row := range rows {
		featured, found := productsById[row.ProductID]
		if !found {
			continue
		}
		views = append(views, dtos.FeaturedProductView{
			ProductId: featured.ID.String(), ProductName: featured.Name, ImageUrl: firstImage[featured.ID], Price: money.Money{AmountMinor: featured.MinPriceMinor, Currency: money.CurrencyCode(featured.Currency)},
			Placement: row.Placement, Position: row.Position, FeaturedSince: row.FeaturedSince.UTC().Format(time.RFC3339), Views: row.ViewCount, Clicks: row.ClickCount,
		})
	}
	return views, nil
}

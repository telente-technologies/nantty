package integrations

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productdailyview"
	"zudomart/modules/catalog/src/generated/ent/productmedia"
	"zudomart/modules/catalog/src/generated/ent/storedailytraffic"
	"zudomart/platform/commerceports"
)

type StoreInsights struct {
	Container *container.Container
}

func (insights StoreInsights) CatalogCountsForStore(ctx context.Context, storeId uuid.UUID) (commerceports.CatalogCounts, error) {
	rows, err := insights.Container.Client.Product.Query().Where(product.StoreID(storeId), product.StatusNEQ(enums.ProductArchived)).Select(product.FieldStatus).All(ctx)
	if err != nil {
		return commerceports.CatalogCounts{}, err
	}
	counts := commerceports.CatalogCounts{TotalProducts: len(rows)}
	for _, row := range rows {
		switch row.Status {
		case enums.ProductActive:
			counts.ActiveProducts++
		case enums.ProductDraft:
			counts.DraftProducts++
		}
	}
	return counts, nil
}

func dayKey(moment time.Time) string { return moment.UTC().Format(time.DateOnly) }

func (insights StoreInsights) DailyTrafficForStore(ctx context.Context, storeId uuid.UUID, from, until time.Time) ([]commerceports.DailyTraffic, error) {
	rows, err := insights.Container.Client.StoreDailyTraffic.Query().Where(storedailytraffic.StoreID(storeId), storedailytraffic.DayGTE(dayKey(from)), storedailytraffic.DayLT(dayKey(until))).
		Order(ent.Asc(storedailytraffic.FieldDay)).All(ctx)
	if err != nil {
		return nil, err
	}
	traffic := make([]commerceports.DailyTraffic, 0, len(rows))
	for _, row := range rows {
		traffic = append(traffic, commerceports.DailyTraffic{Day: row.Day, StoreViews: row.StoreViews, ProductViews: row.ProductViews, Visitors: row.Visitors})
	}
	return traffic, nil
}

func (insights StoreInsights) ProductViewsForStore(ctx context.Context, storeId uuid.UUID, from, until time.Time) (map[uuid.UUID]int, error) {
	rows, err := insights.Container.Client.ProductDailyView.Query().Where(productdailyview.StoreID(storeId), productdailyview.DayGTE(dayKey(from)), productdailyview.DayLT(dayKey(until))).All(ctx)
	if err != nil {
		return nil, err
	}
	views := map[uuid.UUID]int{}
	for _, row := range rows {
		views[row.ProductID] += row.Views
	}
	return views, nil
}

func (insights StoreInsights) DescribeStoreProducts(ctx context.Context, storeId uuid.UUID, onlyActive bool) (map[uuid.UUID]commerceports.ProductCard, error) {
	query := insights.Container.Client.Product.Query().Where(product.StoreID(storeId), product.StatusNEQ(enums.ProductArchived))
	if onlyActive {
		query = query.Where(product.Status(enums.ProductActive))
	}
	rows, err := query.Limit(5000).All(ctx)
	if err != nil || len(rows) == 0 {
		return map[uuid.UUID]commerceports.ProductCard{}, err
	}
	productIds, categoryIds := make([]uuid.UUID, 0, len(rows)), []uuid.UUID{}
	for _, row := range rows {
		productIds = append(productIds, row.ID)
		if row.CategoryID != nil {
			categoryIds = append(categoryIds, *row.CategoryID)
		}
	}
	categories, err := insights.Container.Client.Category.Query().Where(category.IDIn(categoryIds...)).All(ctx)
	if err != nil {
		return nil, err
	}
	categoryNames := map[uuid.UUID]string{}
	for _, row := range categories {
		categoryNames[row.ID] = row.Name
	}
	media, err := insights.Container.Client.ProductMedia.Query().Where(productmedia.ProductIDIn(productIds...)).Order(ent.Asc(productmedia.FieldPosition)).All(ctx)
	if err != nil {
		return nil, err
	}
	images := map[uuid.UUID]string{}
	for _, item := range media {
		if _, taken := images[item.ProductID]; !taken {
			images[item.ProductID] = item.URL
		}
	}
	cards := map[uuid.UUID]commerceports.ProductCard{}
	for _, row := range rows {
		card := commerceports.ProductCard{ProductId: row.ID, Name: row.Name, ImageUrl: images[row.ID], Active: row.Status == enums.ProductActive}
		if row.CategoryID != nil {
			card.CategoryName = categoryNames[*row.CategoryID]
		}
		cards[row.ID] = card
	}
	return cards, nil
}

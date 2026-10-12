package repositories

import (
	"context"
	"strconv"
	"strings"
)

type PromotableProductFilter struct {
	StoresByPriority []string
	Search           string
	Sort             string
	Offset, Limit    int
}

type PromotableProduct struct {
	ProductSummary
	ImageUrl *string
	Stock    *int64
}

func (directory SqlCreatorsDirectory) ListPromotableProducts(ctx context.Context, filter PromotableProductFilter) ([]PromotableProduct, error) {
	if len(filter.StoresByPriority) == 0 {
		return []PromotableProduct{}, nil
	}
	order := "created_at DESC, id"
	switch filter.Sort {
	case "price_asc":
		order = "min_price_minor ASC, id"
	case "price_desc":
		order = "min_price_minor DESC, id"
	case "commission":
		order = "array_position($1::text[], store_id::text), created_at DESC, id"
	}
	products, err := directory.queryProducts(ctx, "store_id::text = ANY($1::text[]) AND status = 'active' AND published_online AND visibility = 'public' AND ($2 = '' OR name ILIKE '%' || $2 || '%') ORDER BY "+
		order+" OFFSET "+strconv.Itoa(max(filter.Offset, 0))+" LIMIT "+strconv.Itoa(max(filter.Limit, 1)), "{"+strings.Join(filter.StoresByPriority, ",")+"}", filter.Search)
	if err != nil {
		return nil, err
	}
	return directory.decorateProducts(ctx, products)
}

func (directory SqlCreatorsDirectory) FindPromotableProducts(ctx context.Context, productIds []string) (map[string]PromotableProduct, error) {
	found, err := directory.FindProducts(ctx, productIds)
	if err != nil {
		return nil, err
	}
	products := make([]ProductSummary, 0, len(found))
	for _, product := range found {
		products = append(products, product)
	}
	decorated, err := directory.decorateProducts(ctx, products)
	byId := map[string]PromotableProduct{}
	for _, product := range decorated {
		byId[product.Id] = product
	}
	return byId, err
}

func (directory SqlCreatorsDirectory) decorateProducts(ctx context.Context, products []ProductSummary) ([]PromotableProduct, error) {
	decorated := make([]PromotableProduct, 0, len(products))
	if len(products) == 0 {
		return decorated, nil
	}
	ids := make([]string, 0, len(products))
	for _, product := range products {
		ids = append(ids, product.Id)
	}
	marks, arguments := placeholders(ids)
	images, err := directory.textByProduct(ctx, "SELECT DISTINCT ON (product_id) product_id::text, url FROM "+directory.table(directory.CatalogSchema, "product_media")+
		" WHERE kind = 'image' AND product_id::text IN ("+marks+") ORDER BY product_id, position", arguments)
	if err != nil {
		return nil, err
	}
	stock, err := directory.textByProduct(ctx, "SELECT product_id::text, SUM(GREATEST(on_hand - reserved, 0))::text FROM "+directory.table(directory.InventorySchema, "stock_levels")+
		" WHERE listed AND product_id::text IN ("+marks+") GROUP BY product_id", arguments)
	if err != nil {
		return nil, err
	}
	for _, product := range products {
		view := PromotableProduct{ProductSummary: product}
		if url, found := images[product.Id]; found {
			view.ImageUrl = &url
		}
		if units, found := stock[product.Id]; found {
			if parsed, err := strconv.ParseInt(units, 10, 64); err == nil {
				view.Stock = &parsed
			}
		}
		decorated = append(decorated, view)
	}
	return decorated, nil
}

func (directory SqlCreatorsDirectory) textByProduct(ctx context.Context, query string, arguments []any) (map[string]string, error) {
	values := map[string]string{}
	if directory.InventorySchema == "" && strings.Contains(query, "stock_levels") {
		return values, nil
	}
	rows, err := directory.Database.QueryContext(ctx, query, arguments...)
	if err != nil {
		if directory.unreadable(err) {
			return values, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var productId, value string
		if err := rows.Scan(&productId, &value); err != nil {
			return nil, err
		}
		values[productId] = value
	}
	return values, rows.Err()
}

func (directory StaticCreatorsDirectory) ListPromotableProducts(_ context.Context, filter PromotableProductFilter) ([]PromotableProduct, error) {
	products := []PromotableProduct{}
	for _, storeId := range filter.StoresByPriority {
		for _, product := range directory.Products {
			if product.StoreId == storeId && product.Published && strings.Contains(strings.ToLower(product.Name), strings.ToLower(filter.Search)) {
				products = append(products, directory.promotable(product))
			}
		}
	}
	if filter.Offset >= len(products) {
		return []PromotableProduct{}, nil
	}
	return products[filter.Offset:min(len(products), filter.Offset+max(filter.Limit, 1))], nil
}

func (directory StaticCreatorsDirectory) FindPromotableProducts(_ context.Context, ids []string) (map[string]PromotableProduct, error) {
	found := map[string]PromotableProduct{}
	for _, id := range ids {
		if product, known := directory.Products[id]; known {
			found[id] = directory.promotable(product)
		}
	}
	return found, nil
}

func (directory StaticCreatorsDirectory) promotable(product ProductSummary) PromotableProduct {
	view := PromotableProduct{ProductSummary: product}
	if stock, known := directory.Stock[product.Id]; known {
		view.Stock = &stock
	}
	return view
}

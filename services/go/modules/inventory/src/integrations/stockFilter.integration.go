package integrations

import (
	"context"

	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

const stockFilterQuery = `
SELECT DISTINCT product_id FROM (
	SELECT product_id, variant_id, SUM(GREATEST(on_hand - reserved, 0)) AS available, MAX(low_stock_level) AS threshold
	FROM stock_levels
	WHERE store_id = $1 AND ($2::uuid IS NULL OR location_id = $2::uuid)
	GROUP BY product_id, variant_id
) per_variant
WHERE CASE $3::text
	WHEN 'low' THEN available > 0 AND available <= threshold
	WHEN 'out' THEN available = 0
	ELSE TRUE
END`

func (stock CommerceStock) ProductIdsMatchingStock(ctx context.Context, storeId uuid.UUID, filter commerceports.StockFilter) ([]uuid.UUID, error) {
	var location any
	if filter.LocationId != nil {
		location = *filter.LocationId
	}
	rows, err := stock.Container.Database.QueryContext(ctx, stockFilterQuery, storeId, location, filter.Level)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	productIds := []uuid.UUID{}
	for rows.Next() {
		var productId uuid.UUID
		if err := rows.Scan(&productId); err != nil {
			return nil, err
		}
		productIds = append(productIds, productId)
	}
	return productIds, rows.Err()
}

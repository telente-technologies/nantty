package catalog_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestReviewsNeedAReceivedPurchaseAndAuthorsCanDeleteThem(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("reviewowner")
	buyerId, buyer := harness.account("reviewbuyer")
	_, stranger := harness.account("reviewstranger")
	shop := harness.store(ownerId, "Review Shop")
	item := harness.product(shop, "Reviewed Item", 3000, true)
	path := "/api/v1/products/" + item.ID.String()

	harness.expect("POST", path+"/reviews", "", map[string]any{"rating": 5, "text": "Great"}, 401)
	harness.expect("POST", path+"/reviews", buyer, map[string]any{"rating": 5, "text": "Great"}, 403)
	harness.purchases.grant(buyerId, item.ID)
	harness.expect("POST", path+"/reviews", buyer, map[string]any{"rating": 6, "text": "Great"}, 400)
	harness.expect("POST", path+"/reviews", buyer, map[string]any{"rating": 4, "text": ""}, 400)
	review := harness.expect("POST", path+"/reviews", buyer, map[string]any{"rating": 4, "text": "Lovely fabric"}, 201)
	if review["isVerifiedPurchase"] != true || review["rating"] != float64(4) {
		t.Fatalf("review: %v", review)
	}
	harness.expect("POST", path+"/reviews", buyer, map[string]any{"rating": 5, "text": "Twice"}, 409)
	summary := harness.expect("GET", path+"/rating-summary", "", nil, 200)
	if summary["count"] != float64(1) || summary["average"] != float64(4) {
		t.Fatalf("summary should count the review: %v", summary)
	}
	if listed := items(harness.expect("GET", path+"/reviews", "", nil, 200), "reviews"); len(listed) != 1 {
		t.Fatalf("public reviews: %v", listed)
	}

	reviewPath := "/api/v1/reviews/" + review["id"].(string)
	harness.expect("DELETE", reviewPath, stranger, nil, 404)
	harness.expect("DELETE", reviewPath, buyer, nil, 204)
	harness.expect("DELETE", reviewPath, buyer, nil, 404)
	ctx := context.Background()
	product, _ := harness.client().Product.Get(ctx, item.ID)
	store, _ := harness.client().Store.Get(ctx, shop.ID)
	if product.RatingCount != 0 || product.RatingSum != 0 || store.RatingCount != 0 {
		t.Fatalf("ratings must be recomputed: product %d/%d store %d", product.RatingSum, product.RatingCount, store.RatingCount)
	}
	if !contains(harness.outboxTypes(), "review.deleted") {
		t.Fatal("deletion must be published")
	}
	harness.expect("POST", path+"/reviews", buyer, map[string]any{"rating": 5, "text": "Changed my mind"}, 201)
}

func TestProductListingFiltersSortsAndSellerScoping(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, owner := harness.account("filterowner")
	_, outsider := harness.account("notamember")
	shop := harness.store(ownerId, "Filter Shop")
	cheap := harness.product(shop, "Cheap Socks", 1_000, true)
	mid := harness.product(shop, "Mid Shirt", 5_000, true)
	dear := harness.product(shop, "Dear Coat", 20_000, true)
	harness.product(shop, "Hidden Draft", 2_000, false)
	if err := harness.client().Product.UpdateOne(mid).SetUnitsSold(50).Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	ids := func(body map[string]any) []string {
		found := []string{}
		for _, raw := range items(body, "data") {
			found = append(found, raw.(map[string]any)["id"].(string))
		}
		return found
	}
	ascending := ids(harness.expect("GET", "/api/v1/products?sort=price_asc", "", nil, 200))
	if len(ascending) != 3 || ascending[0] != cheap.ID.String() || ascending[2] != dear.ID.String() {
		t.Fatalf("price_asc: %v", ascending)
	}
	if descending := ids(harness.expect("GET", "/api/v1/products?sort=price_desc&limit=1", "", nil, 200)); descending[0] != dear.ID.String() {
		t.Fatalf("price_desc: %v", descending)
	}
	if popular := ids(harness.expect("GET", "/api/v1/products?sort=popular", "", nil, 200)); popular[0] != mid.ID.String() {
		t.Fatalf("popular: %v", popular)
	}
	bounded := ids(harness.expect("GET", "/api/v1/products?minPrice=2000&maxPrice=10000&currency=NGN", "", nil, 200))
	if len(bounded) != 1 || bounded[0] != mid.ID.String() {
		t.Fatalf("price range: %v", bounded)
	}
	harness.expect("GET", "/api/v1/products?minPrice=2000", "", nil, 400)
	harness.expect("GET", "/api/v1/products?sort=cheapest", "", nil, 400)
	harness.expect("GET", "/api/v1/products?categorySlug=nope", "", nil, 400)
	page := harness.expect("GET", "/api/v1/products?sort=price_asc&limit=2", "", nil, 200)
	next := ids(harness.expect("GET", "/api/v1/products?sort=price_asc&limit=2&cursor="+page["nextCursor"].(string), "", nil, 200))
	if len(next) != 1 || next[0] != dear.ID.String() {
		t.Fatalf("cursor paging: %v", next)
	}

	harness.expect("GET", "/api/v1/seller/products", outsider, nil, 403)
	if all := items(harness.expect("GET", "/api/v1/seller/products", owner, nil, 200), "data"); len(all) != 4 {
		t.Fatalf("sellers see drafts too: %d", len(all))
	}
	harness.stock.matching = []uuid.UUID{dear.ID}
	low := ids(harness.expect("GET", "/api/v1/seller/products?stock=low&locationId="+uuid.NewString(), owner, nil, 200))
	if len(low) != 1 || low[0] != dear.ID.String() || harness.stock.lastLevel != "low" {
		t.Fatalf("stock filter: %v", low)
	}
	harness.expect("GET", "/api/v1/seller/products?stock=lots", owner, nil, 400)
}

func TestProductImportRunsOnceAndReportsRows(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, owner := harness.account("importowner")
	shop := harness.store(ownerId, "Import Shop")
	location := uuid.New()
	harness.stock.locations[location] = shop.ID
	rows := []map[string]any{
		{"rowNumber": 2, "productName": "Imported Tee", "sku": "TEE-1", "price": "1500", "option1Name": "Size", "option1Value": "M"},
		{"rowNumber": 3, "productName": "Imported Tee", "sku": "TEE-2", "price": "1500", "option1Name": "Size", "option1Value": "L"},
		{"rowNumber": 4, "productName": "Broken", "sku": "", "price": "abc"},
	}
	body := map[string]any{"locationId": location.String(), "rows": rows}
	key := []string{"Idempotency-Key", "import-00000001"}
	harness.expect("POST", "/api/v1/seller/products/import", owner, body, 400)
	harness.expect("POST", "/api/v1/seller/products/import", owner, map[string]any{"locationId": uuid.NewString(), "rows": rows}, 400, key...)
	result := harness.expect("POST", "/api/v1/seller/products/import", owner, body, 200, key...)
	failed := items(result, "failed")
	if result["created"] != float64(1) || len(failed) != 1 || failed[0].(map[string]any)["row"] != float64(4) || result["status"] != "completed" {
		t.Fatalf("import: %v", result)
	}
	replay := harness.expect("POST", "/api/v1/seller/products/import", owner, body, 200, key...)
	if replay["jobId"] != result["jobId"] {
		t.Fatal("the same key must replay the first import")
	}
	harness.expect("POST", "/api/v1/seller/products/import", owner, map[string]any{"locationId": location.String(), "rows": rows[:1]}, 409, key...)
}

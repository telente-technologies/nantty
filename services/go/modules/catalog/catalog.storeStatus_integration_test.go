package catalog

import (
	"testing"
)

func TestSuspendedStoresAreHiddenAndTheChangeIsAudited(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("suspendowner")
	shop := harness.store(ownerId, "Shady Shop")
	listed := harness.product(shop, "Listed Item", 5000, true)
	draft := harness.product(shop, "Draft Item", 7000, false)
	moderator, stepUp := harness.staff("moderation:reports")
	storePath := "/api/v1/stores/" + shop.ID.String()

	page := items(harness.expect("GET", "/api/v1/products", "", nil, 200), "data")
	if len(page) != 1 || page[0].(map[string]any)["id"] != listed.ID.String() {
		t.Fatalf("only the published product is listed: %v", page)
	}
	harness.expect("GET", "/api/v1/products/"+draft.ID.String(), "", nil, 404)
	slug := harness.expect("GET", "/api/v1/stores/"+shop.Slug, "", nil, 200)
	if slug["id"] != shop.ID.String() || slug["followers"] != float64(0) {
		t.Fatalf("lookup by slug: %v", slug)
	}

	harness.expect("POST", "/api/v1/admin/stores/"+shop.ID.String()+"/status", moderator, map[string]any{"status": "suspended", "reason": "Counterfeit goods"}, 403)
	suspended := harness.expect("POST", "/api/v1/admin/stores/"+shop.ID.String()+"/status", moderator, map[string]any{"status": "suspended", "reason": "Counterfeit goods"}, 200, stepUp...)
	if suspended["status"] != "suspended" {
		t.Fatalf("suspend: %v", suspended)
	}
	harness.expect("POST", "/api/v1/admin/stores/"+shop.ID.String()+"/status", moderator, map[string]any{"status": "suspended", "reason": "Counterfeit goods"}, 409, stepUp...)
	if len(items(harness.expect("GET", "/api/v1/products", "", nil, 200), "data")) != 0 {
		t.Fatal("products of a suspended store must be hidden")
	}
	harness.expect("GET", "/api/v1/products/"+listed.ID.String(), "", nil, 404)
	harness.expect("GET", storePath, "", nil, 404)
	if !harness.audit.has("store.suspended") || !contains(harness.outboxTypes(), "store.statusChanged") {
		t.Fatal("suspension must be audited and published")
	}

	harness.expect("POST", "/api/v1/admin/stores/"+shop.ID.String()+"/status", moderator, map[string]any{"status": "active", "reason": "Appeal upheld"}, 200, stepUp...)
	if len(items(harness.expect("GET", "/api/v1/products", "", nil, 200), "data")) != 1 {
		t.Fatal("reinstated store products are listed again")
	}
	if !harness.audit.has("store.reinstated") {
		t.Fatal("reinstatement must be audited")
	}
}

func TestStoreFollowStatsMyStoresAndSitemap(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, owner := harness.account("followowner")
	_, fan := harness.account("storefan")
	shop := harness.store(ownerId, "Follow Me")
	second := harness.store(ownerId, "Second Shop")
	harness.product(shop, "Sitemap Product", 1000, true)
	path := "/api/v1/stores/" + shop.ID.String()

	harness.follows.followers[shop.ID] = 7
	detail := harness.expect("GET", path, fan, nil, 200)
	if detail["followers"] != float64(7) || detail["isFollowing"] != true {
		t.Fatalf("follow stats come from social: %v", detail)
	}
	if anonymous := harness.expect("GET", path, "", nil, 200); anonymous["isFollowing"] != false {
		t.Fatalf("guests never follow: %v", anonymous)
	}

	mine := harness.expect("GET", "/api/v1/seller/stores/mine", owner, nil, 200, "X-Seller-Store", second.ID.String())
	entries := items(mine, "data")
	if len(entries) != 2 || mine["nextCursor"] != nil {
		t.Fatalf("my stores: %v", mine)
	}
	for _, raw := range entries {
		entry := raw.(map[string]any)
		if entry["role"] != "owner" || entry["isCurrent"] != (entry["storeId"] == second.ID.String()) {
			t.Fatalf("entry: %v", entry)
		}
	}

	products := harness.expect("GET", "/api/v1/sitemap/products?page=1", "", nil, 200)
	stores := harness.expect("GET", "/api/v1/sitemap/stores", "", nil, 200)
	if len(items(products, "entries")) != 1 || products["totalPages"] != float64(1) || len(items(stores, "entries")) != 2 {
		t.Fatalf("sitemap: %v %v", products, stores)
	}
	harness.expect("GET", "/api/v1/sitemap/profiles", "", nil, 404)
	harness.expect("GET", "/api/v1/sitemap/products?page=0", "", nil, 400)
}

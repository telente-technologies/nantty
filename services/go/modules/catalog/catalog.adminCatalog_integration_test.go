package catalog

import (
	"testing"
	"time"
)

func TestAdminsManageCategoriesWithAuditAndPermissions(t *testing.T) {
	harness := startHttpHarness(t)
	admin, _ := harness.staff("catalog:manage")
	outsider, _ := harness.staff("users:read")
	_, buyer := harness.account("plainbuyer")

	harness.expect("GET", "/api/v1/admin/catalog/categories", "", nil, 401)
	harness.expect("GET", "/api/v1/admin/catalog/categories", buyer, nil, 401)
	harness.expect("GET", "/api/v1/admin/catalog/categories", outsider, nil, 403)
	seeded := items(harness.expect("GET", "/api/v1/admin/catalog/categories", admin, nil, 200), "items")
	if len(seeded) == 0 {
		t.Fatal("the starter taxonomy should be listed")
	}

	harness.expect("POST", "/api/v1/admin/catalog/categories", admin, map[string]any{"name": "Books", "parentId": nil, "reason": "x"}, 400)
	created := harness.expect("POST", "/api/v1/admin/catalog/categories", admin, map[string]any{"name": "Books", "parentId": nil, "iconName": "book24", "reason": "New department"}, 201)
	books := created["item"].(map[string]any)
	if books["slug"] != "books" || books["isActive"] != true || books["parentId"] != nil || books["iconName"] != "book24" {
		t.Fatalf("created: %v", books)
	}
	bookId := books["id"].(string)
	harness.expect("POST", "/api/v1/admin/catalog/categories", admin, map[string]any{"name": "Books again", "slug": "books", "parentId": nil, "reason": "Duplicate slug"}, 409)
	child := harness.expect("POST", "/api/v1/admin/catalog/categories", admin, map[string]any{"name": "Novels", "parentId": bookId, "reason": "Subcategory"}, 201)["item"].(map[string]any)
	if child["parentId"] != bookId {
		t.Fatalf("child: %v", child)
	}
	harness.expect("POST", "/api/v1/admin/catalog/categories", admin, map[string]any{"name": "Too deep", "parentId": child["id"], "reason": "Third level"}, 400)
	harness.expect("PATCH", "/api/v1/admin/catalog/categories/"+bookId, admin, map[string]any{"parentId": child["id"], "reason": "Cycle attempt"}, 400)

	renamed := harness.expect("PATCH", "/api/v1/admin/catalog/categories/"+bookId, admin, map[string]any{"name": "Books & Media", "reason": "Rename"}, 200)["item"].(map[string]any)
	if renamed["name"] != "Books & Media" || renamed["slug"] != "books" {
		t.Fatalf("renamed: %v", renamed)
	}
	harness.expect("PATCH", "/api/v1/admin/catalog/categories/"+bookId, admin, map[string]any{"name": "Books & Media", "reason": "Same again"}, 409)

	moved := items(harness.expect("POST", "/api/v1/admin/catalog/categories/"+bookId+"/move", admin, map[string]any{"direction": "up"}, 200), "items")
	if len(moved) != len(seeded)+2 {
		t.Fatalf("move returns the full list: %d", len(moved))
	}
	harness.expect("POST", "/api/v1/admin/catalog/categories/"+child["id"].(string)+"/move", admin, map[string]any{"direction": "down"}, 409)

	harness.expect("POST", "/api/v1/admin/catalog/categories/"+bookId+"/deactivate", admin, map[string]any{"reason": "Seasonal pause"}, 200)
	detail := harness.expect("GET", "/api/v1/admin/catalog/categories/"+child["id"].(string), admin, nil, 200)
	if detail["item"].(map[string]any)["isActive"] != false {
		t.Fatalf("deactivation must cascade to subcategories: %v", detail)
	}
	harness.expect("POST", "/api/v1/admin/catalog/categories/"+bookId+"/deactivate", admin, map[string]any{"reason": "Seasonal pause"}, 409)
	harness.expect("GET", "/api/v1/categories/"+bookId, "", nil, 404)
	harness.expect("POST", "/api/v1/admin/catalog/categories/"+bookId+"/activate", admin, map[string]any{"reason": "Back in season"}, 200)
	public := harness.expect("GET", "/api/v1/categories/"+bookId, "", nil, 200)
	if public["name"] != "Books & Media" {
		t.Fatalf("public category: %v", public)
	}
	history := items(harness.expect("GET", "/api/v1/admin/catalog/categories/"+bookId, admin, nil, 200), "history")
	if len(history) < 4 {
		t.Fatalf("history should list the audited changes, got %d", len(history))
	}
	for _, action := range []string{"catalog.category_created", "catalog.category_updated", "catalog.category_reordered", "catalog.category_deactivated", "catalog.category_activated"} {
		if !harness.audit.has(action) {
			t.Fatalf("missing audit %s", action)
		}
	}
}

func TestMartFeaturesDriveHighlights(t *testing.T) {
	harness := startHttpHarness(t)
	admin, _ := harness.staff("catalog:manage")
	library := harness.expect("GET", "/api/v1/admin/catalog/features/image-library", admin, nil, 200)
	images := items(library, "items")
	if len(images) == 0 || len(items(library, "countries")) == 0 {
		t.Fatalf("library: %v", library)
	}
	imageId := images[0].(map[string]any)["id"]
	start := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	body := map[string]any{"title": "Weekend deals", "kind": "HERO_BANNER", "imageId": imageId, "targetType": "COLLECTION", "targetValue": "sales_of_the_day",
		"countries": []string{"NG"}, "startsAt": start, "reason": "Weekend campaign"}
	bad := map[string]any{"title": "Off site", "kind": "PROMO_BANNER", "imageId": imageId, "targetType": "URL", "targetValue": "https://evil.example.com",
		"countries": []string{"NG"}, "startsAt": start, "reason": "Should fail"}
	harness.expect("POST", "/api/v1/admin/catalog/features", admin, bad, 400)
	feature := harness.expect("POST", "/api/v1/admin/catalog/features", admin, body, 201)["item"].(map[string]any)
	if feature["status"] != "DRAFT" || feature["priority"] != float64(1) || feature["imageUrl"] == "" {
		t.Fatalf("feature: %v", feature)
	}
	second := harness.expect("POST", "/api/v1/admin/catalog/features", admin, map[string]any{"title": "New in", "kind": "PROMO_BANNER", "imageId": imageId,
		"targetType": "COLLECTION", "targetValue": "new_arrivals", "countries": []string{"NG", "GH"}, "startsAt": start, "reason": "Fresh listings"}, 201)["item"].(map[string]any)
	featureId := feature["id"].(string)
	harness.expect("POST", "/api/v1/admin/catalog/features/"+featureId+"/publish", admin, map[string]any{"reason": "Go live"}, 200)
	harness.expect("POST", "/api/v1/admin/catalog/features/"+featureId+"/publish", admin, map[string]any{"reason": "Go live"}, 409)
	reordered := items(harness.expect("POST", "/api/v1/admin/catalog/features/"+second["id"].(string)+"/move", admin, map[string]any{"direction": "up"}, 200), "items")
	if reordered[0].(map[string]any)["id"] != second["id"] {
		t.Fatalf("move up: %v", reordered)
	}
	harness.expect("PATCH", "/api/v1/admin/catalog/features/"+featureId, admin, map[string]any{"subtitle": "Up to 40% off", "reason": "Copy tweak"}, 200)

	highlights := items(harness.expect("GET", "/api/v1/mart/highlights?limit=5", "", nil, 200), "data")
	first := highlights[0].(map[string]any)
	if first["id"] != featureId || first["kind"] != "deals_of_the_day" || first["subtitle"] != "Up to 40% off" {
		t.Fatalf("published feature should lead the highlights: %v", highlights)
	}
	if len(highlights) != 3 {
		t.Fatalf("editorial fallbacks fill the other collections: %v", highlights)
	}
	detail := harness.expect("GET", "/api/v1/admin/catalog/features/"+featureId, admin, nil, 200)
	if len(items(detail, "history")) < 2 {
		t.Fatalf("feature history: %v", detail)
	}
}

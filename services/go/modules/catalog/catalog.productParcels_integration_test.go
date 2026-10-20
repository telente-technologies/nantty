package catalog

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/integrations"
)

func TestProductParcelFieldsSaveUpdateAndFlowIntoCheckoutSnapshot(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, owner := harness.account("parcelowner")
	harness.store(ownerId, "Parcel Shop")
	body := map[string]any{
		"name": "Parcel API item", "description": "", "status": "draft", "taxable": true, "trackInventory": false, "publishedOnline": false,
		"tags": []string{}, "imageMediaIds": []string{},
		"options": []map[string]any{{"name": "Size", "values": []string{"S", "M"}}},
		"variants": []map[string]any{
			{"sku": "PARCEL-API-S", "priceMinor": 500_000, "lowStockThreshold": 5, "optionValues": map[string]string{"Size": "S"},
				"weightGrams": 250, "lengthMm": 300, "widthMm": 200, "heightMm": 50},
			{"sku": "PARCEL-API-M", "priceMinor": 500_000, "lowStockThreshold": 5, "optionValues": map[string]string{"Size": "M"}},
		},
		"weightGrams": 500, "lengthMm": 300, "widthMm": 200, "heightMm": 100,
		"packageCategory": "apparel", "packageCount": 2, "fragile": true,
		"contentsDescription": "two folded shirts", "declaredValueMinor": 500_000,
	}
	created := harness.expect("POST", "/api/v1/seller/products", owner, body, 201)
	productId := harness.parseId(created["id"])
	view := harness.expect("GET", "/api/v1/seller/products/"+productId.String(), owner, nil, 200)
	assertParcelView(t, view, 500, 300, 200, 100, "apparel", 2, true, "two folded shirts", 500_000)
	variantIds := variantIdentifiers(t, harness, view)
	small, medium := variantIds["PARCEL-API-S"], variantIds["PARCEL-API-M"]

	preserved := parcelPatchBody("Parcel API item renamed", small, medium, nil)
	harness.expect("PATCH", "/api/v1/seller/products/"+productId.String(), owner, preserved, 200)
	preservedView := harness.expect("GET", "/api/v1/seller/products/"+productId.String(), owner, nil, 200)
	assertParcelView(t, preservedView, 500, 300, 200, 100, "apparel", 2, true, "two folded shirts", 500_000)

	changed := parcelPatchBody("Parcel API item renamed", small, medium, map[string]any{
		"weightGrams": 600, "lengthMm": 310, "widthMm": 210, "heightMm": 110,
		"packageCategory": "home", "packageCount": 3, "fragile": false,
		"contentsDescription": "three items", "declaredValueMinor": 600_000,
	})
	changed["variants"].([]map[string]any)[0]["weightGrams"] = 300
	changed["variants"].([]map[string]any)[0]["lengthMm"] = 310
	changed["variants"].([]map[string]any)[0]["widthMm"] = 210
	changed["variants"].([]map[string]any)[0]["heightMm"] = 60
	harness.expect("PATCH", "/api/v1/seller/products/"+productId.String(), owner, changed, 200)
	changedView := harness.expect("GET", "/api/v1/seller/products/"+productId.String(), owner, nil, 200)
	assertParcelView(t, changedView, 600, 310, 210, 110, "home", 3, false, "three items", 600_000)
	changedVariant, _ := items(changedView, "variants")[0].(map[string]any)
	if changedVariant["weightGrams"] != float64(300) || changedVariant["heightMm"] != float64(60) {
		t.Fatalf("variant parcel update not returned: %v", changedVariant)
	}

	snapshots, err := (integrations.CommerceCatalog{Container: harness.module.Container}).ResolveProductsForCheckoutInCountry(context.Background(), []uuid.UUID{small, medium}, "NG")
	if err != nil {
		t.Fatalf("resolve checkout snapshot: %v", err)
	}
	smallSnapshot, found := snapshots[small]
	if !found {
		t.Fatalf("missing snapshot for %s", small)
	}
	if smallSnapshot.WeightGrams == nil || *smallSnapshot.WeightGrams != 300 || smallSnapshot.LengthMm == nil || *smallSnapshot.LengthMm != 310 ||
		smallSnapshot.WidthMm == nil || *smallSnapshot.WidthMm != 210 || smallSnapshot.HeightMm == nil || *smallSnapshot.HeightMm != 60 {
		t.Fatalf("variant parcel overrides not applied: %+v", smallSnapshot)
	}
	mediumSnapshot, found := snapshots[medium]
	if !found {
		t.Fatalf("missing snapshot for %s", medium)
	}
	if mediumSnapshot.WeightGrams == nil || *mediumSnapshot.WeightGrams != 600 || mediumSnapshot.LengthMm == nil || *mediumSnapshot.LengthMm != 310 ||
		mediumSnapshot.WidthMm == nil || *mediumSnapshot.WidthMm != 210 || mediumSnapshot.HeightMm == nil || *mediumSnapshot.HeightMm != 110 {
		t.Fatalf("product parcel fallback not applied: %+v", mediumSnapshot)
	}
	if mediumSnapshot.PackageCategory != "home" || mediumSnapshot.PackageCount != 3 || mediumSnapshot.Fragile ||
		mediumSnapshot.ContentsDescription != "three items" || mediumSnapshot.DeclaredValueMinor == nil || *mediumSnapshot.DeclaredValueMinor != 600_000 {
		t.Fatalf("product parcel metadata missing from snapshot: %+v", mediumSnapshot)
	}
}

func assertParcelView(t *testing.T, view map[string]any, weight, length, width, height int, category string, count int, fragile bool, contents string, declared int64) {
	t.Helper()
	if view["weightGrams"] != float64(weight) || view["lengthMm"] != float64(length) || view["widthMm"] != float64(width) || view["heightMm"] != float64(height) {
		t.Fatalf("product dimensions not returned: %v", view)
	}
	if view["packageCategory"] != category || view["packageCount"] != float64(count) || view["fragile"] != fragile {
		t.Fatalf("product package metadata not returned: %v", view)
	}
	if view["contentsDescription"] != contents || view["declaredValueMinor"] != float64(declared) {
		t.Fatalf("product declared contents not returned: %v", view)
	}
}

func variantIdentifiers(t *testing.T, harness *httpHarness, view map[string]any) map[string]uuid.UUID {
	t.Helper()
	variants := items(view, "variants")
	if len(variants) != 2 {
		t.Fatalf("expected two variants, got %v", variants)
	}
	identifiers := map[string]uuid.UUID{}
	for _, raw := range variants {
		variantView, _ := raw.(map[string]any)
		identifiers[variantView["sku"].(string)] = harness.parseId(variantView["id"])
	}
	return identifiers
}

func parcelPatchBody(name string, small, medium uuid.UUID, parcel map[string]any) map[string]any {
	body := map[string]any{
		"name": name, "description": "", "status": "draft", "taxable": true, "trackInventory": false, "publishedOnline": false,
		"tags": []string{}, "imageMediaIds": []string{},
		"options": []map[string]any{{"name": "Size", "values": []string{"S", "M"}}},
		"variants": []map[string]any{
			{"id": small.String(), "sku": "PARCEL-API-S", "priceMinor": 500_000, "lowStockThreshold": 5, "optionValues": map[string]string{"Size": "S"}},
			{"id": medium.String(), "sku": "PARCEL-API-M", "priceMinor": 500_000, "lowStockThreshold": 5, "optionValues": map[string]string{"Size": "M"}},
		},
	}
	for key, value := range parcel {
		body[key] = value
	}
	return body
}

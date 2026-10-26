package catalog

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/services"
)

func TestBrandSellingToggleHidesTheStorefrontButKeepsOrdersWorking(t *testing.T) {
	harness := startHttpHarness(t)
	registry, _ := startProfileRuleHarness(harness)
	ctx := context.Background()
	ownerId, _ := harness.account("selling-owner")
	owner, stepUp := harness.tokens.SignAccountTokensWithStepUpForTest(t, ownerId.String())
	_, fan := harness.account("selling-fan")
	fanId, _ := harness.account("selling-fan-two")
	fanToken, fanStepUp := harness.tokens.SignAccountTokensWithStepUpForTest(t, fanId.String())
	brand := harness.expect("POST", "/api/v1/brands", owner, brandBody("sellingbrand"), http.StatusCreated, "Idempotency-Key", "brand-sell-0000001")
	path := "/api/v1/brands/" + brand["id"].(string)
	brandId := harness.parseId(brand["id"].(string))

	harness.expect("POST", path+"/storefront", owner, map[string]any{}, http.StatusConflict, "Idempotency-Key", "storefront-0000001")
	status, body := harness.call("PATCH", path, owner, map[string]any{"sellingEnabled": true})
	if status != http.StatusForbidden || body["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("turning selling on needs step-up: %d %v", status, body)
	}
	status, body = harness.call("PATCH", path, fanToken, map[string]any{"sellingEnabled": true}, "X-Step-Up-Token", fanStepUp)
	if status != http.StatusForbidden || body["code"] != "OWNER_ONLY" {
		t.Fatalf("only the owner can toggle selling: %d %v", status, body)
	}
	harness.expect("PATCH", path, fan, map[string]any{"sellingEnabled": true}, http.StatusForbidden)
	on := harness.expect("PATCH", path, owner, map[string]any{"sellingEnabled": true}, http.StatusOK, "X-Step-Up-Token", stepUp)
	if on["sellingEnabled"] != true || on["showsMart"] != true {
		t.Fatalf("selling on: %v", on)
	}
	storefront := harness.expect("POST", path+"/storefront", owner, map[string]any{}, http.StatusCreated, "Idempotency-Key", "storefront-0000002")
	harness.expect("POST", path+"/storefront", owner, map[string]any{}, http.StatusConflict, "Idempotency-Key", "storefront-0000003")
	if _, claimed := registry.slot(ownerId); claimed {
		t.Fatal("a brand storefront is a sales channel and does not take the Store slot")
	}
	shop, err := harness.client().Store.Get(ctx, harness.parseId(storefront["id"].(string)))
	if err != nil || shop.Channel != enums.ChannelBrand || shop.BrandID == nil || *shop.BrandID != brandId {
		t.Fatalf("storefront row: %+v %v", shop, err)
	}
	listed := harness.product(shop, "Brand Tee", 5000, true)
	if err := harness.client().Product.UpdateOne(listed).SetBrandID(brandId).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	if detail := harness.expect("GET", path, "", nil, http.StatusOK); detail["storefront"] == nil {
		t.Fatalf("selling on shows the storefront: %v", detail)
	}

	harness.expect("PATCH", path, owner, map[string]any{"sellingEnabled": false}, http.StatusOK, "X-Step-Up-Token", stepUp)
	paused, _ := harness.client().Store.Get(ctx, shop.ID)
	if paused.Status != enums.StorePaused {
		t.Fatalf("selling off pauses the storefront, got %s", paused.Status)
	}
	harness.expect("GET", "/api/v1/stores/"+shop.ID.String(), "", nil, http.StatusNotFound)
	if detail := harness.expect("GET", path, "", nil, http.StatusOK); detail["storefront"] != nil || detail["showsMart"] != false {
		t.Fatalf("selling off hides the storefront and Mart icon: %v", detail)
	}
	if shelf := harness.expect("GET", path+"/products", "", nil, http.StatusOK); len(items(shelf, "officialStoreProducts"))+len(items(shelf, "otherSellersProducts")) != 0 {
		t.Fatalf("selling off hides brand storefront products: %v", shelf)
	}
	if err := services.AssertStoreAcceptsNewListings(ctx, harness.module.Container, paused); !errors.Is(err, catalogerrors.BrandSellingOff) {
		t.Fatalf("selling off blocks new listings: %v", err)
	}
	if kept, err := harness.client().Product.Get(ctx, listed.ID); err != nil || kept.Status != "active" {
		t.Fatalf("existing listings are kept for open orders: %v", err)
	}
	harness.expect("GET", "/api/v1/seller/stores/mine", owner, nil, http.StatusOK, "X-Seller-Store", shop.ID.String())

	harness.expect("PATCH", path, owner, map[string]any{"sellingEnabled": true}, http.StatusOK, "X-Step-Up-Token", stepUp)
	if resumed, _ := harness.client().Store.Get(ctx, shop.ID); resumed.Status != enums.StoreActive {
		t.Fatalf("selling on again reopens the storefront, got %s", resumed.Status)
	}
	if err := services.AssertStoreAcceptsNewListings(ctx, harness.module.Container, shop); err != nil {
		t.Fatalf("selling on accepts listings again: %v", err)
	}
	registry.hold(brandId, "held")
	harness.expect("PATCH", path, owner, map[string]any{"sellingEnabled": false}, http.StatusOK, "X-Step-Up-Token", stepUp)
	status, body = harness.call("PATCH", path, owner, map[string]any{"sellingEnabled": true}, "X-Step-Up-Token", stepUp)
	if status != http.StatusConflict || body["code"] != "PROFILE_ON_HOLD" {
		t.Fatalf("a held brand cannot start selling: %d %v", status, body)
	}
}

func TestStaffReassignABrandWithStepUpAReasonAndAnAuditEntry(t *testing.T) {
	harness := startHttpHarness(t)
	registry, _ := startProfileRuleHarness(harness)
	_, owner := harness.account("reassign-owner")
	targetId, _ := harness.account("reassign-target")
	busyId, busy := harness.account("reassign-busy")
	brand := harness.expect("POST", "/api/v1/brands", owner, brandBody("reassignbrand"), http.StatusCreated, "Idempotency-Key", "brand-move-0000001")
	harness.expect("POST", "/api/v1/brands", busy, brandBody("busybrand"), http.StatusCreated, "Idempotency-Key", "brand-move-0000002")
	path := "/api/v1/admin/brands/" + brand["id"].(string) + "/reassign"
	staff, stepUp := harness.staff("brands:revoke")
	harness.expect("POST", path, staff, map[string]any{"toAccountId": targetId.String(), "reason": "Trademark owner proved ownership"}, http.StatusForbidden)
	harness.expect("POST", path, staff, map[string]any{"toAccountId": targetId.String(), "reason": "no"}, http.StatusBadRequest, stepUp...)
	harness.expect("POST", path, staff, map[string]any{"toAccountId": uuid.NewString(), "reason": "Unknown account target"}, http.StatusNotFound, stepUp...)
	status, body := harness.call("POST", path, staff, map[string]any{"toAccountId": busyId.String(), "reason": "Target already has a brand"}, stepUp...)
	if status != http.StatusConflict || body["code"] != "PROFILE_LIMIT_ONE_BRAND" {
		t.Fatalf("reassigning to an account with a brand is refused: %d %v", status, body)
	}
	moved := harness.expect("POST", path, staff, map[string]any{"toAccountId": targetId.String(), "reason": "Trademark owner proved ownership"}, http.StatusOK, stepUp...)
	if moved["ownerAccountId"] != targetId.String() || !harness.audit.has("brand.reassigned") || registry.brandOf(targetId).String() != brand["id"] {
		t.Fatalf("reassigned: %v", moved)
	}
}

package catalog

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent/category"
	"zudomart/modules/catalog/src/services"
)

func brandBody(handle string) map[string]any {
	return map[string]any{"name": "Brand " + handle, "handle": handle, "logoUrl": nil, "coverUrl": nil, "categoryId": "7d1d4c1e-2f4a-4b8e-9a51-3c1f0e2d9b10", "description": "Made in Lagos", "website": nil}
}

func TestStoreCreationClaimsTheAccountSlotAndReleasesOnFailure(t *testing.T) {
	harness := startHttpHarness(t)
	registry, directory := startProfileRuleHarness(harness)
	ownerId, owner := harness.account("slot-owner")
	page := directory.addBusiness(ownerId)
	created := harness.expect("POST", "/api/v1/stores", owner, map[string]any{"businessProfileId": page.String(), "name": "Slot Shop"}, http.StatusCreated, "Idempotency-Key", "store-slot-00000001")
	if slot, _ := registry.slot(ownerId); slot.StoreId == nil || slot.StoreId.String() != created["id"] {
		t.Fatalf("the registry slot carries the new store id: %v", slot)
	}
	status, body := harness.call("POST", "/api/v1/stores", owner, map[string]any{"businessProfileId": directory.addBusiness(ownerId).String(), "name": "Second Shop"}, "Idempotency-Key", "store-slot-00000002")
	if status != http.StatusConflict || body["code"] != "STORE_LIMIT_ONE" {
		t.Fatalf("a second store for the account is refused: %d %v", status, body)
	}
	businessId, business := harness.account("business-owner")
	registry.setBusiness(businessId)
	status, body = harness.call("POST", "/api/v1/stores", business, map[string]any{"businessProfileId": directory.addBusiness(businessId).String(), "name": "Bypass Shop"}, "Idempotency-Key", "store-slot-00000003")
	if status != http.StatusConflict || body["code"] != "PROFILE_LIMIT_STORE_OR_BUSINESS" {
		t.Fatalf("an API call that skips the UI is still refused: %d %v", status, body)
	}
	memberId, member := harness.account("team-member")
	status, _ = harness.call("POST", "/api/v1/stores", member, map[string]any{"businessProfileId": page.String(), "name": "On Behalf"}, "Idempotency-Key", "store-slot-00000004")
	if _, claimed := registry.slot(memberId); status != http.StatusUnprocessableEntity || claimed {
		t.Fatalf("a team member cannot open a store on the owner's business page: %d", status)
	}
}

func TestOneBrandPerAccountEvenWithDoubleTapsAndParallelCreates(t *testing.T) {
	harness := startHttpHarness(t)
	registry, _ := startProfileRuleHarness(harness)
	ownerId, owner := harness.account("brand-racer")
	first := harness.expect("POST", "/api/v1/brands", owner, brandBody("racerbrand"), http.StatusCreated, "Idempotency-Key", "brand-tap-0000001")
	replayed := harness.expect("POST", "/api/v1/brands", owner, brandBody("racerbrand"), http.StatusCreated, "Idempotency-Key", "brand-tap-0000001")
	if replayed["id"] != first["id"] || first["sellingEnabled"] != false {
		t.Fatalf("a double tap replays the same brand with selling off: %v %v", first, replayed)
	}
	status, body := harness.call("POST", "/api/v1/brands", owner, brandBody("racerbrandtwo"), "Idempotency-Key", "brand-tap-0000002")
	if status != http.StatusConflict || body["code"] != "PROFILE_LIMIT_ONE_BRAND" {
		t.Fatalf("a second brand is refused: %d %v", status, body)
	}
	_, racer := harness.account("parallel-brand")
	results := make([]int, 6)
	var group sync.WaitGroup
	for index := range results {
		group.Add(1)
		go func() {
			defer group.Done()
			results[index], _ = harness.call("POST", "/api/v1/brands", racer, brandBody("parallel"+string(rune('a'+index))), "Idempotency-Key", "brand-race-000000"+string(rune('a'+index)))
		}()
	}
	group.Wait()
	created := 0
	for _, status := range results {
		if status == http.StatusCreated {
			created++
		}
	}
	if created != 1 {
		t.Fatalf("parallel brand creates, want one winner: %v", results)
	}
	if registry.brandOf(ownerId).String() != first["id"] {
		t.Fatalf("the registry holds the created brand: %v", registry.brandOf(ownerId))
	}
}

func TestSellerApplicationsReserveTheStoreSlotAndRejectionsFreeIt(t *testing.T) {
	harness := startHttpHarness(t)
	registry, _ := startProfileRuleHarness(harness)
	fashion, err := harness.client().Category.Query().Where(category.StoreIDIsNil(), category.Slug("fashion")).Only(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	blockedId, blocked := harness.account("has-business")
	registry.setBusiness(blockedId)
	status, body := harness.call("POST", "/api/v1/seller/applications", blocked, applicationBody(fashion.ID.String()), "Idempotency-Key", "apply-rule-0000001")
	if status != http.StatusConflict || body["code"] != "PROFILE_LIMIT_STORE_OR_BUSINESS" {
		t.Fatalf("an account with a business page cannot apply to sell: %d %v", status, body)
	}
	applicantId, applicant := harness.account("rule-applicant")
	submitted := harness.expect("POST", "/api/v1/seller/applications", applicant, applicationBody(fashion.ID.String()), http.StatusCreated, "Idempotency-Key", "apply-rule-0000002")
	if slot, _ := registry.slot(applicantId); slot.ProfileId.String() != submitted["id"] {
		t.Fatalf("the application reserves the store slot: %v", slot)
	}
	reviewer, _ := harness.staff("applications:sellers")
	harness.expect("POST", "/api/v1/admin/applications/sellers/"+submitted["id"].(string)+"/reject", reviewer, map[string]any{"reason": "Documents are unreadable"}, http.StatusOK)
	if _, held := registry.slot(applicantId); held {
		t.Fatal("a rejected application frees the store slot")
	}
}

func TestHeldProfilesAndBrandsWithSellingOffAcceptNoNewListings(t *testing.T) {
	harness := startHttpHarness(t)
	registry, _ := startProfileRuleHarness(harness)
	ctx := context.Background()
	shop := harness.store(uuid.New(), "Held Shop")
	if err := services.AssertStoreAcceptsNewListings(ctx, harness.module.Container, shop); err != nil {
		t.Fatalf("an active store accepts listings: %v", err)
	}
	registry.hold(shop.BusinessProfileID, "held")
	if err := services.AssertStoreAcceptsNewListings(ctx, harness.module.Container, shop); !errors.Is(err, catalogerrors.ProfileOnHold) {
		t.Fatalf("a grandfathered extra store accepts no new listings: %v", err)
	}
}

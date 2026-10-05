package catalog

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

func TestLiveSourcesConfirmMembershipAndProductOwnership(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("liveowner")
	staffId, _ := harness.account("livestaff")
	store := harness.store(ownerId, "Live Store")
	if err := harness.client().StoreMember.Create().SetStoreID(store.ID).SetAccountID(staffId).SetRole("sales").Exec(context.Background()); err != nil {
		t.Fatal(err)
	}
	other := harness.store(uuid.New(), "Other Store")
	mine := harness.product(store, "Ankara Dress", 1_500_000, true)
	theirs := harness.product(other, "Not Mine", 100, true)
	token := []string{"X-Internal-Token", harnessInternalToken}

	harness.expect("GET", "/internal/v1/stores/"+store.ID.String()+"/members/"+ownerId.String(), "", nil, 401)
	owner := harness.expect("GET", "/internal/v1/stores/"+store.ID.String()+"/members/"+ownerId.String(), "", nil, 200, token...)
	if owner["isMember"] != true || owner["role"] != "owner" {
		t.Fatalf("owner membership: %v", owner)
	}
	staff := harness.expect("GET", "/internal/v1/stores/"+store.ID.String()+"/members/"+staffId.String(), "", nil, 200, token...)
	if staff["isMember"] != true || staff["role"] != "sales" {
		t.Fatalf("staff membership: %v", staff)
	}
	stranger := harness.expect("GET", "/internal/v1/stores/"+store.ID.String()+"/members/"+uuid.NewString(), "", nil, 200, token...)
	if stranger["isMember"] != false || stranger["role"] != nil {
		t.Fatalf("stranger membership: %v", stranger)
	}
	missing := harness.expect("GET", "/internal/v1/stores/"+uuid.NewString()+"/members/"+ownerId.String(), "", nil, 200, token...)
	if missing["isMember"] != false {
		t.Fatalf("unknown store must not grant membership: %v", missing)
	}

	path := "/internal/v1/stores/" + store.ID.String() + "/products/ownership"
	harness.expect("POST", path, "", map[string]any{"productIds": []string{mine.ID.String()}}, 401)
	harness.expect("POST", path, "", map[string]any{"productIds": []string{}}, 400, token...)
	harness.expect("POST", path, "", map[string]any{"productIds": []string{"nope"}}, 400, token...)
	result := harness.expect("POST", path, "", map[string]any{"productIds": []string{mine.ID.String(), theirs.ID.String(), uuid.NewString()}}, 200, token...)
	owned, _ := result["owned"].([]any)
	products, _ := result["products"].([]any)
	if len(owned) != 1 || owned[0] != mine.ID.String() || len(products) != 1 {
		t.Fatalf("ownership: %v", result)
	}
	snapshot := products[0].(map[string]any)
	price := snapshot["price"].(map[string]any)
	if snapshot["title"] != "Ankara Dress" || price["amountMinor"] != float64(1_500_000) || price["currency"] != "NGN" || snapshot["imageUrl"] != nil {
		t.Fatalf("snapshot: %v", snapshot)
	}
}

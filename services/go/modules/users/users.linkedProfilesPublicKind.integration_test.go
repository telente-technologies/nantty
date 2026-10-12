package users

import (
	"net/http"
	"testing"

	"github.com/google/uuid"
)

func TestOtherUsersSeeTheProfileKindAndWhetherTheMartShows(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	viewerId, viewer := harness.newAccount("kind.viewer", "Viewer")

	businessId, businessToken := harness.newAccount("kind.business", "Business")
	harness.expect("POST", "/api/v1/users/me/business-profiles", businessToken, businessBody("kind.business.page", "business"), http.StatusCreated)
	seen := harness.expect("GET", "/api/v1/users/"+businessId, viewer, nil, http.StatusOK)
	if seen["profileKind"] != "business" || seen["showsMart"] != false {
		t.Fatalf("a business page owner never shows a Mart tab to others: %v", seen)
	}

	storeId, storeToken := harness.newAccount("kind.store", "Store")
	if code, _ := harness.claim(storeId, "store", uuid.NewString()); code != http.StatusOK {
		t.Fatalf("pending application reserves the slot, got %d", code)
	}
	if seen = harness.expect("GET", "/api/v1/users/"+storeId, viewer, nil, http.StatusOK); seen["profileKind"] != "store" || seen["showsMart"] != false {
		t.Fatalf("a reserved store with no store yet shows no Mart: %v", seen)
	}
	page := harness.expect("POST", "/api/v1/users/me/business-profiles", storeToken, businessBody("kind.store.page", "store"), http.StatusCreated)
	harness.expect("POST", "/api/v1/internal/accounts/"+storeId+"/linked-profiles/claim", "", map[string]any{"kind": "store", "profileId": page["id"], "storeId": uuid.NewString()}, http.StatusOK, internalHeaders...)
	if seen = harness.expect("GET", "/api/v1/users/"+storeId, viewer, nil, http.StatusOK); seen["profileKind"] != "store" || seen["showsMart"] != true {
		t.Fatalf("an opened store shows the Mart: %v", seen)
	}

	if seen = harness.expect("GET", "/api/v1/users/"+viewerId, businessToken, nil, http.StatusOK); seen["profileKind"] != "personal" || seen["showsMart"] != false {
		t.Fatalf("a plain account is personal with no Mart: %v", seen)
	}
	if mine := harness.expect("GET", "/api/v1/users/me", businessToken, nil, http.StatusOK); mine["profileKind"] != "business" {
		t.Fatalf("the own profile carries the kind too: %v", mine)
	}
}

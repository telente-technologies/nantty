package catalog

import (
	"net/http"
	"testing"
)

func TestStoreFollowRoutesRequireAuthenticationAndReturnAuthoritativeState(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, _ := harness.account("storefollowowner")
	_, follower := harness.account("storefollower")
	shop := harness.store(ownerId, "Followable Store")
	path := "/api/v1/stores/" + shop.ID.String() + "/follow"

	harness.expect(http.MethodPost, path, "", nil, http.StatusUnauthorized)

	followed := harness.expect(http.MethodPost, path, follower, nil, http.StatusOK)
	if followed["storeId"] != shop.ID.String() || followed["isFollowing"] != true || followed["followers"] != float64(1) {
		t.Fatalf("follow response: %v", followed)
	}
	if duplicate := harness.expect(http.MethodPost, path, follower, nil, http.StatusOK); duplicate["followers"] != float64(1) {
		t.Fatalf("repeated follow must be idempotent: %v", duplicate)
	}

	detail := harness.expect(http.MethodGet, "/api/v1/stores/"+shop.ID.String(), follower, nil, http.StatusOK)
	if detail["isFollowing"] != true || detail["followers"] != float64(1) {
		t.Fatalf("store detail should reflect the follow write: %v", detail)
	}

	unfollowed := harness.expect(http.MethodDelete, path, follower, nil, http.StatusOK)
	if unfollowed["storeId"] != shop.ID.String() || unfollowed["isFollowing"] != false || unfollowed["followers"] != float64(0) {
		t.Fatalf("unfollow response: %v", unfollowed)
	}
	if repeated := harness.expect(http.MethodDelete, path, follower, nil, http.StatusOK); repeated["followers"] != float64(0) {
		t.Fatalf("repeated unfollow must not decrement below zero: %v", repeated)
	}

	harness.expect(http.MethodPost, "/api/v1/stores/not-a-uuid/follow", follower, nil, http.StatusBadRequest)
}

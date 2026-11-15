package ads_test

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/interfaces"
)

type fakeDestinationOwnership struct {
	mutex    sync.Mutex
	managers map[string]map[string]bool
}

func (ownership *fakeDestinationOwnership) allow(kind, targetId, userId string) {
	ownership.mutex.Lock()
	defer ownership.mutex.Unlock()
	key := kind + ":" + targetId
	if ownership.managers[key] == nil {
		ownership.managers[key] = map[string]bool{}
	}
	ownership.managers[key][userId] = true
}

func (ownership *fakeDestinationOwnership) Owns(_ context.Context, query interfaces.OwnershipQuery) (bool, error) {
	ownership.mutex.Lock()
	defer ownership.mutex.Unlock()
	return ownership.managers[query.Kind+":"+query.TargetId][query.OwnerUserId], nil
}

type fakePromotedDirectory struct {
	mutex        sync.Mutex
	destinations map[string]interfaces.PromotedDestination
	owners       map[string]string
}

func (directory *fakePromotedDirectory) put(destination interfaces.PromotedDestination, ownerUserId string) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	directory.destinations[destination.Kind+":"+destination.Id] = destination
	directory.owners[destination.Kind+":"+destination.Id] = ownerUserId
}

func (directory *fakePromotedDirectory) LookupDestinations(_ context.Context, kind string, ids []string) (map[string]interfaces.PromotedDestination, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	found := map[string]interfaces.PromotedDestination{}
	for _, id := range ids {
		if destination, exists := directory.destinations[kind+":"+id]; exists {
			found[id] = destination
		}
	}
	return found, nil
}

func (directory *fakePromotedDirectory) ListPromotableDestinations(_ context.Context, kind, ownerUserId string) ([]interfaces.PromotedDestination, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	listed := []interfaces.PromotedDestination{}
	for key, destination := range directory.destinations {
		if destination.Kind == kind && directory.owners[key] == ownerUserId {
			listed = append(listed, destination)
		}
	}
	return listed, nil
}

func withPromotedDestinations(ownership *fakeDestinationOwnership, directory *fakePromotedDirectory) harnessOption {
	return func(collaborators *src.Collaborators, _ *configs.AdsSettings) {
		collaborators.Ownership, collaborators.Promoted = ownership, directory
	}
}

func entityBoostBody(destinationType, targetId, goal string) map[string]any {
	return map[string]any{"destinationType": destinationType, "targetId": targetId, "goal": goal, "audience": map[string]any{"mode": "automatic"},
		"dailyBudget": map[string]any{"amountMinor": 100_000, "currency": "NGN"}, "durationDays": 3, "paymentMethod": "balance"}
}

func entityEstimateBody(destinationType, targetId, goal string) map[string]any {
	body := entityBoostBody(destinationType, targetId, goal)
	delete(body, "paymentMethod")
	return body
}

func TestStoresAndProfilesCanBeBoostedOnlyByThoseWhoManageThem(t *testing.T) {
	money := newFakeMoneyAccounts()
	ownership := &fakeDestinationOwnership{managers: map[string]map[string]bool{}}
	directory := &fakePromotedDirectory{destinations: map[string]interfaces.PromotedDestination{}, owners: map[string]string{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withPromotedDestinations(ownership, directory))
	owner, manager, cashier, stranger := h.newUser("folake"), h.newUser("storemanager"), h.newUser("storecashier"), h.newUser("stranger")
	for _, user := range []testUser{owner, manager, cashier, stranger} {
		money.levels[user.id.String()] = 1
	}
	storeId, suspendedStoreId := uuid.NewString(), uuid.NewString()
	ownership.allow("store", storeId, owner.id.String())
	ownership.allow("store", storeId, manager.id.String())
	ownership.allow("store", suspendedStoreId, owner.id.String())
	ownership.allow("profile", owner.id.String(), owner.id.String())
	logo := "https://cdn.nantty.com/logo.png"
	directory.put(interfaces.PromotedDestination{Kind: "store", Id: storeId, Name: "Folake Fabrics", Handle: "folakefabrics", AvatarUrl: &logo, Verified: true, Available: true}, owner.id.String())
	directory.put(interfaces.PromotedDestination{Kind: "store", Id: suspendedStoreId, Name: "Closed Shop", Handle: "closedshop", Available: false}, owner.id.String())
	directory.put(interfaces.PromotedDestination{Kind: "profile", Id: owner.id.String(), Name: "Folake", Handle: "folake", Private: true, Available: true}, owner.id.String())

	if refused := h.expect("POST", "/api/v1/ads/boosts", &stranger, "stranger-store-boost", entityBoostBody("store", storeId, "store_visits"), http.StatusForbidden); refused["code"] != "DESTINATION_NOT_OWNED" {
		t.Fatalf("a stranger cannot promote someone else's store: %v", refused)
	}
	if refused := h.expect("POST", "/api/v1/ads/boosts", &cashier, "cashier-store-boost", entityBoostBody("store", storeId, "store_visits"), http.StatusForbidden); refused["code"] != "DESTINATION_NOT_OWNED" {
		t.Fatalf("staff without a managing role cannot promote the store: %v", refused)
	}
	if refused := h.expect("POST", "/api/v1/ads/boosts", &stranger, "stranger-profile-boost", entityBoostBody("profile", owner.id.String(), "profile_visits"), http.StatusForbidden); refused["code"] != "DESTINATION_NOT_OWNED" {
		t.Fatalf("a stranger cannot promote someone else's profile: %v", refused)
	}
	if refused := h.expect("POST", "/api/v1/ads/boosts", &owner, "suspended-store-boost", entityBoostBody("store", suspendedStoreId, "store_visits"), http.StatusConflict); refused["code"] != "DESTINATION_UNAVAILABLE" {
		t.Fatalf("a suspended store cannot be promoted: %v", refused)
	}
	h.expect("POST", "/api/v1/ads/boosts", &owner, "store-goal-on-profile", entityBoostBody("profile", owner.id.String(), "store_visits"), http.StatusBadRequest)
	h.expect("POST", "/api/v1/ads/boosts/estimate", &owner, "", entityEstimateBody("store", storeId, "views"), http.StatusBadRequest)
	estimate := h.expect("POST", "/api/v1/ads/boosts/estimate", &owner, "", entityEstimateBody("store", storeId, "store_visits"), http.StatusOK)
	if label, _ := estimate["estimatedResultsLabel"].(string); label == "" || label[len(label)-len("store visits"):] != "store visits" {
		t.Fatalf("a store estimate counts store visits: %v", estimate)
	}

	managerBoost := h.expect("POST", "/api/v1/ads/boosts", &manager, "manager-store-boost", entityBoostBody("store", storeId, "store_visits"), http.StatusCreated)["boost"].(map[string]any)
	if managerBoost["destinationType"] != "store" || managerBoost["targetId"] != storeId || managerBoost["postId"] != "" {
		t.Fatalf("a store manager can promote the store: %v", managerBoost)
	}
	profileBoost := h.expect("POST", "/api/v1/ads/boosts", &owner, "owner-profile-boost", entityBoostBody("profile", owner.id.String(), "profile_visits"), http.StatusCreated)["boost"].(map[string]any)
	if profileBoost["destinationType"] != "profile" || profileBoost["goal"] != "profile_visits" {
		t.Fatalf("the owner can promote their own profile: %v", profileBoost)
	}
	storeBoost := h.expect("POST", "/api/v1/ads/boosts", &owner, "owner-store-boost", entityBoostBody("store", storeId, "store_visits"), http.StatusCreated)["boost"].(map[string]any)
	results := storeBoost["results"].(map[string]any)
	if _, counted := results["storeVisits"]; !counted {
		t.Fatalf("store boosts report store visits: %v", storeBoost)
	}
	row := h.boostRow(storeBoost["id"].(string))
	ad := h.module.Container.Client.Ad.GetX(context.Background(), row.AdID)
	if ad.Format != "store" || ad.Creative.Input.Destination.Type != "store" || ad.Creative.Input.Source.Type != "store" || ad.Creative.Input.Headline != "Boosted store" {
		t.Fatalf("a store boost runs a store creative that opens the store: %+v", ad.Creative.Input)
	}

	listed := h.expect("GET", "/api/v1/ads/accounts/"+row.AccountID.String()+"/promotable-destinations?type=store", &owner, "", nil, http.StatusOK)["data"].([]any)
	if len(listed) != 2 {
		t.Fatalf("the picker lists only the owner's stores: %v", listed)
	}
	for _, entry := range listed {
		store := entry.(map[string]any)
		if store["id"] == suspendedStoreId && (store["eligible"] != false || store["ineligibleReason"] == nil) {
			t.Fatalf("a suspended store is listed as not promotable: %v", store)
		}
	}
	h.expect("GET", "/api/v1/ads/accounts/"+row.AccountID.String()+"/promotable-destinations?type=store", &stranger, "", nil, http.StatusNotFound)
	h.expect("GET", "/api/v1/ads/accounts/"+row.AccountID.String()+"/promotable-destinations?type=live", &owner, "", nil, http.StatusBadRequest)
	sources := h.expect("GET", "/api/v1/ads/accounts/"+row.AccountID.String()+"/content-sources?type=store", &owner, "", nil, http.StatusOK)["data"].([]any)
	if len(sources) != 2 || sources[0].(map[string]any)["type"] != "store" {
		t.Fatalf("the store source tab lists promotable stores: %v", sources)
	}
}

func TestPromotedStoreAndProfileAdsCarryTheirCardAndPauseWhenTheyBecomeUnavailable(t *testing.T) {
	money := newFakeMoneyAccounts()
	ownership := &fakeDestinationOwnership{managers: map[string]map[string]bool{}}
	directory := &fakePromotedDirectory{destinations: map[string]interfaces.PromotedDestination{}, owners: map[string]string{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withPromotedDestinations(ownership, directory))
	owner, staff, viewer := h.newUser("tobi"), h.newUser("entityreviewer", "name:Rita", "perm:ads:review"), h.newUser("viewer")
	money.levels[owner.id.String()] = 1
	storeId := uuid.NewString()
	ownership.allow("store", storeId, owner.id.String())
	ownership.allow("profile", owner.id.String(), owner.id.String())
	store := interfaces.PromotedDestination{Kind: "store", Id: storeId, Name: "Tobi Gadgets", Handle: "tobigadgets", Verified: true, CheckmarkColor: "gold", Available: true}
	directory.put(store, owner.id.String())
	ctx := context.Background()

	boost := h.expect("POST", "/api/v1/ads/boosts", &owner, "served-store-boost", entityBoostBody("store", storeId, "store_visits"), http.StatusCreated)["boost"].(map[string]any)
	row := h.boostRow(boost["id"].(string))
	h.expect("POST", "/api/v1/admin/ads/"+row.AdID.String()+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	decide := map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "entity-session"}
	served, _ := h.expect("POST", "/api/v1/ads/decide", &viewer, "", decide, http.StatusOK)["ad"].(map[string]any)
	if served == nil || served["label"] != "Boosted" {
		t.Fatalf("an approved store boost serves in the feed with the Boosted label: %v", served)
	}
	creative := served["creative"].(map[string]any)
	promoted, _ := creative["promoted"].(map[string]any)
	identity := creative["identity"].(map[string]any)
	if promoted == nil || promoted["kind"] != "store" || promoted["id"] != storeId || promoted["checkmarkColor"] != "gold" || identity["name"] != "Tobi Gadgets" {
		t.Fatalf("the served creative carries the store card, not the boost account name: %v", creative)
	}
	if destination := creative["destination"].(map[string]any); destination["type"] != "store" || destination["targetId"] != storeId {
		t.Fatalf("the store ad opens the store: %v", destination)
	}

	store.Available = false
	directory.put(store, owner.id.String())
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	paused := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "entity-session-3"}, http.StatusOK)
	if paused["ad"] != nil {
		t.Fatalf("a suspended store's ads stop serving: %v", paused)
	}
	store.Available = true
	directory.put(store, owner.id.String())
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	if resumed := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "entity-session-4"}, http.StatusOK); resumed["ad"] == nil {
		t.Fatalf("a reinstated store's ads serve again: %v", resumed)
	}
}

func TestAPrivateProfileAdStillServesItsCardMarkedPrivate(t *testing.T) {
	money := newFakeMoneyAccounts()
	ownership := &fakeDestinationOwnership{managers: map[string]map[string]bool{}}
	directory := &fakePromotedDirectory{destinations: map[string]interfaces.PromotedDestination{}, owners: map[string]string{}}
	h := startAdsAgainstFreshSchema(t, withMoneyAccounts(money, &fakeTopUps{status: "pending"}), withPromotedDestinations(ownership, directory))
	owner, staff, viewer := h.newUser("kemi"), h.newUser("profilereviewer", "name:Rita", "perm:ads:review"), h.newUser("viewer")
	money.levels[owner.id.String()] = 1
	ownership.allow("profile", owner.id.String(), owner.id.String())
	directory.put(interfaces.PromotedDestination{Kind: "profile", Id: owner.id.String(), Name: "Kemi", Handle: "kemi", Private: true, Available: true}, owner.id.String())
	ctx := context.Background()

	boost := h.expect("POST", "/api/v1/ads/boosts", &owner, "private-profile-boost", entityBoostBody("profile", owner.id.String(), "profile_visits"), http.StatusCreated)["boost"].(map[string]any)
	row := h.boostRow(boost["id"].(string))
	h.expect("POST", "/api/v1/admin/ads/"+row.AdID.String()+"/approve", &staff, "", map[string]any{}, http.StatusOK)
	if err := h.module.Container.Candidates.ReloadFromDatabase(ctx); err != nil {
		t.Fatal(err)
	}
	served, _ := h.expect("POST", "/api/v1/ads/decide", &viewer, "", map[string]any{"slot": map[string]any{"kind": "feedPost"}, "sessionId": "private-session"}, http.StatusOK)["ad"].(map[string]any)
	if served == nil {
		t.Fatal("a private profile's ad still serves")
	}
	creative := served["creative"].(map[string]any)
	promoted := creative["promoted"].(map[string]any)
	if promoted["kind"] != "profile" || promoted["private"] != true || creative["callToAction"] != "follow" {
		t.Fatalf("the profile card says the account is private so follows become requests: %v", creative)
	}
}

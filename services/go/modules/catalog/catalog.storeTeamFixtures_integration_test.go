package catalog

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/platform/commerceports"
	"zudomart/platform/usersdirectory"
)

type fakeDirectory struct {
	mutex    sync.Mutex
	profiles map[uuid.UUID]usersdirectory.ProfileName
}

func (directory *fakeDirectory) add(handle string) uuid.UUID {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	accountId := uuid.New()
	directory.profiles[accountId] = usersdirectory.ProfileName{AccountId: accountId, ProfileId: uuid.New(), Handle: handle, Name: strings.ToUpper(handle[:1]) + handle[1:]}
	return accountId
}

func (directory *fakeDirectory) PersonalProfilesByAccount(_ context.Context, accountIds []uuid.UUID) (map[uuid.UUID]usersdirectory.ProfileName, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	found := map[uuid.UUID]usersdirectory.ProfileName{}
	for _, accountId := range accountIds {
		if profile, known := directory.profiles[accountId]; known {
			found[accountId] = profile
		}
	}
	return found, nil
}

func (directory *fakeDirectory) SearchActivePersonalProfiles(_ context.Context, text string, excluded []uuid.UUID, limit int) ([]usersdirectory.ProfileName, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	skip := map[uuid.UUID]bool{}
	for _, accountId := range excluded {
		skip[accountId] = true
	}
	matches := []usersdirectory.ProfileName{}
	for accountId, profile := range directory.profiles {
		if !skip[accountId] && strings.Contains(profile.Handle, strings.TrimPrefix(text, "@")) && len(matches) < limit {
			matches = append(matches, profile)
		}
	}
	return matches, nil
}

func (directory *fakeDirectory) ActivePersonalProfileExists(ctx context.Context, accountId uuid.UUID) (usersdirectory.ProfileName, bool, error) {
	profiles, _ := directory.PersonalProfilesByAccount(ctx, []uuid.UUID{accountId})
	profile, found := profiles[accountId]
	return profile, found, nil
}

func (directory *fakeDirectory) FindBusinessProfile(context.Context, uuid.UUID) (usersdirectory.BusinessProfile, bool, error) {
	return usersdirectory.BusinessProfile{}, false, nil
}

func (directory *fakeDirectory) AccountsAllowingPersonalizedAds(context.Context, []uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}

func (directory *fakeDirectory) PersonalProfileCountry(context.Context, uuid.UUID) (string, error) {
	return "NG", nil
}

func (directory *fakeDirectory) PrivacyChoicesOf(context.Context, uuid.UUID) (usersdirectory.PrivacyChoices, bool, error) {
	return usersdirectory.PrivacyChoices{}, false, nil
}

type fakeLocations struct {
	commerceports.InventoryStock
	owned map[uuid.UUID]uuid.UUID
}

func (locations fakeLocations) StoreOwnsLocations(_ context.Context, storeId uuid.UUID, locationIds []uuid.UUID) (bool, error) {
	for _, locationId := range locationIds {
		if locations.owned[locationId] != storeId {
			return false, nil
		}
	}
	return true, nil
}

type teamFixture struct {
	module    *src.Module
	directory *fakeDirectory
	store     *ent.Store
	ownerId   uuid.UUID
	location  uuid.UUID
}

func startTeamFixture(t *testing.T) teamFixture {
	t.Helper()
	module := startAgainstFreshSchema(t)
	directory := &fakeDirectory{profiles: map[uuid.UUID]usersdirectory.ProfileName{}}
	module.Container.Users = directory
	ownerId := directory.add("adaowner")
	ctx := context.Background()
	store, err := module.Container.Client.Store.Create().SetOwnerAccountID(ownerId).SetBusinessProfileID(uuid.New()).SetName("Ada Fabrics").
		SetSlug("ada-fabrics-" + uuid.NewString()[:8]).SetCountryCode("NG").SetCurrency("NGN").Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := module.Container.Client.StoreMember.Create().SetStoreID(store.ID).SetAccountID(ownerId).SetRole("owner").Exec(ctx); err != nil {
		t.Fatal(err)
	}
	location := uuid.New()
	commerceports.Default.RegisterInventoryStock(fakeLocations{owned: map[uuid.UUID]uuid.UUID{location: store.ID}})
	return teamFixture{module: module, directory: directory, store: store, ownerId: ownerId, location: location}
}

func (fixture teamFixture) ownerAccess() commerceports.StoreAccess {
	return commerceports.StoreAccess{StoreId: fixture.store.ID, OwnerAccountId: fixture.ownerId, Role: "owner", Currency: "NGN", CountryCode: "NG", StoreStatus: "active"}
}

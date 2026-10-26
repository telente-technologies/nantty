package catalog

import (
	"context"
	"sync"

	"github.com/google/uuid"

	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/interfaces"
	"nantty/platform/usersdirectory"
)

type fakeRegistry struct {
	mutex    sync.Mutex
	slots    map[uuid.UUID]interfaces.LinkedClaim
	brands   map[uuid.UUID]uuid.UUID
	statuses map[uuid.UUID]string
	released []interfaces.LinkedClaim
	moved    []uuid.UUID
	allowAll bool
}

func newFakeRegistry() *fakeRegistry {
	return &fakeRegistry{slots: map[uuid.UUID]interfaces.LinkedClaim{}, brands: map[uuid.UUID]uuid.UUID{}, statuses: map[uuid.UUID]string{}}
}

func (registry *fakeRegistry) Claim(_ context.Context, accountId uuid.UUID, claim interfaces.LinkedClaim) error {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if registry.allowAll {
		return nil
	}
	if claim.Kind == "brand" {
		if existing, taken := registry.brands[accountId]; taken && existing != claim.ProfileId {
			return catalogerrors.ProfileLimitOneBrand
		}
		registry.brands[accountId] = claim.ProfileId
		return nil
	}
	existing, taken := registry.slots[accountId]
	if taken && (existing.Kind != "store" || (existing.StoreId != nil && claim.StoreId != nil && *existing.StoreId != *claim.StoreId)) {
		return catalogerrors.ProfileLimitStoreOrBusiness
	}
	registry.slots[accountId] = claim
	return nil
}

func (registry *fakeRegistry) Release(_ context.Context, accountId uuid.UUID, claim interfaces.LinkedClaim) error {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	registry.released = append(registry.released, claim)
	if claim.Kind == "brand" && registry.brands[accountId] == claim.ProfileId {
		delete(registry.brands, accountId)
	}
	if claim.Kind == "store" && registry.slots[accountId].ProfileId == claim.ProfileId {
		delete(registry.slots, accountId)
	}
	return nil
}

func (registry *fakeRegistry) StatusOf(_ context.Context, _ uuid.UUID, _ string, profileId uuid.UUID) (string, error) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if status, known := registry.statuses[profileId]; known {
		return status, nil
	}
	return "active", nil
}

func (registry *fakeRegistry) TransferBrand(_ context.Context, brandId, fromAccountId, toAccountId uuid.UUID) error {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	if _, taken := registry.brands[toAccountId]; taken {
		return catalogerrors.ProfileLimitOneBrand
	}
	delete(registry.brands, fromAccountId)
	registry.brands[toAccountId] = brandId
	registry.moved = append(registry.moved, brandId)
	return nil
}

func (registry *fakeRegistry) hold(profileId uuid.UUID, status string) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	registry.statuses[profileId] = status
}

func (registry *fakeRegistry) slot(accountId uuid.UUID) (interfaces.LinkedClaim, bool) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	claim, found := registry.slots[accountId]
	return claim, found
}

func (registry *fakeRegistry) setBusiness(accountId uuid.UUID) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	registry.slots[accountId] = interfaces.LinkedClaim{Kind: "business", ProfileId: uuid.New()}
}

func (registry *fakeRegistry) brandOf(accountId uuid.UUID) uuid.UUID {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	return registry.brands[accountId]
}

type businessDirectory struct {
	*fakeDirectory
	mutex    sync.Mutex
	business map[uuid.UUID]usersdirectory.BusinessProfile
}

func (directory *businessDirectory) addBusiness(accountId uuid.UUID) uuid.UUID {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	profileId := uuid.New()
	directory.business[profileId] = usersdirectory.BusinessProfile{ProfileId: profileId, AccountId: accountId, Handle: "page-" + profileId.String()[:6], CountryCode: "NG", Active: true}
	return profileId
}

func (directory *businessDirectory) FindBusinessProfile(_ context.Context, profileId uuid.UUID) (usersdirectory.BusinessProfile, bool, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	profile, found := directory.business[profileId]
	return profile, found, nil
}

func startProfileRuleHarness(harness *httpHarness) (*fakeRegistry, *businessDirectory) {
	registry := newFakeRegistry()
	directory := &businessDirectory{fakeDirectory: harness.directory, business: map[uuid.UUID]usersdirectory.BusinessProfile{}}
	harness.module.Container.LinkedProfiles = registry
	harness.module.Container.Users = directory
	return registry, directory
}

package repositories

import (
	"context"
	"strings"
)

type StaticCreatorsDirectory struct {
	Owners       map[string]string
	Lives        map[string]LiveSummary
	Blocks       map[[2]string]bool
	Users        map[string]UserSummary
	Stores       map[string]StoreSummary
	Products     map[string]ProductSummary
	Followers    map[string]int64
	Applications map[string]string
	Stock        map[string]int64
}

func (directory StaticCreatorsDirectory) FollowerCount(_ context.Context, accountId string) (int64, error) {
	return directory.Followers[accountId], nil
}

func (directory StaticCreatorsDirectory) ApplicationStatus(_ context.Context, accountId string) (string, error) {
	return directory.Applications[accountId], nil
}

func (directory StaticCreatorsDirectory) ContentOwner(_ context.Context, targetType, targetId string) (string, error) {
	if targetType == "live" {
		if live, found := directory.Lives[targetId]; found {
			return live.HostId, nil
		}
		return "", ErrTargetNotFound
	}
	if owner, found := directory.Owners[targetType+":"+targetId]; found {
		return owner, nil
	}
	return "", ErrTargetNotFound
}

func (directory StaticCreatorsDirectory) FindLive(_ context.Context, liveId string) (LiveSummary, bool, error) {
	live, found := directory.Lives[liveId]
	return live, found, nil
}

func (directory StaticCreatorsDirectory) BlockedEitherWay(_ context.Context, first, second string) (bool, error) {
	return directory.Blocks[[2]string{first, second}] || directory.Blocks[[2]string{second, first}], nil
}

func (directory StaticCreatorsDirectory) FindUserSummaries(_ context.Context, ids []string) (map[string]UserSummary, error) {
	found := map[string]UserSummary{}
	for _, id := range ids {
		if user, known := directory.Users[id]; known {
			found[id] = user
		}
	}
	return found, nil
}

func (directory StaticCreatorsDirectory) FindStores(_ context.Context, ids []string) (map[string]StoreSummary, error) {
	found := map[string]StoreSummary{}
	for _, id := range ids {
		if store, known := directory.Stores[id]; known {
			found[id] = store
		}
	}
	return found, nil
}

func (directory StaticCreatorsDirectory) FindOwnedStore(_ context.Context, ownerUserId, storeId string) (StoreSummary, bool, error) {
	for _, store := range directory.Stores {
		if store.OwnerUserId == ownerUserId && (storeId == "" || store.Id == storeId) {
			return store, true, nil
		}
	}
	return StoreSummary{}, false, nil
}

func (directory StaticCreatorsDirectory) FindProducts(_ context.Context, ids []string) (map[string]ProductSummary, error) {
	found := map[string]ProductSummary{}
	for _, id := range ids {
		if product, known := directory.Products[id]; known {
			found[id] = product
		}
	}
	return found, nil
}

func (directory StaticCreatorsDirectory) ListStoreProducts(_ context.Context, storeId, search string, limit int) ([]ProductSummary, error) {
	products := []ProductSummary{}
	for _, product := range directory.Products {
		if product.StoreId == storeId && product.Published && strings.Contains(strings.ToLower(product.Name), strings.ToLower(search)) && len(products) < limit {
			products = append(products, product)
		}
	}
	return products, nil
}

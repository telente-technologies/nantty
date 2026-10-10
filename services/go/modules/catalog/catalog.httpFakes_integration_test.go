package catalog

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type fakeStock struct {
	commerceports.InventoryStock
	mutex     sync.Mutex
	locations map[uuid.UUID]uuid.UUID
	matching  []uuid.UUID
	lastLevel string
}

func (stock *fakeStock) AvailableByVariant(context.Context, []uuid.UUID) (map[uuid.UUID]int, error) {
	return map[uuid.UUID]int{}, nil
}

func (stock *fakeStock) StockLevelsForVariants(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID][]commerceports.VariantStockLevel, error) {
	return map[uuid.UUID][]commerceports.VariantStockLevel{}, nil
}

func (stock *fakeStock) OnHandByVariant(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]int, error) {
	return map[uuid.UUID]int{}, nil
}

func (stock *fakeStock) StoreOwnsLocations(_ context.Context, storeId uuid.UUID, locationIds []uuid.UUID) (bool, error) {
	stock.mutex.Lock()
	defer stock.mutex.Unlock()
	for _, locationId := range locationIds {
		if stock.locations[locationId] != storeId {
			return false, nil
		}
	}
	return true, nil
}

func (stock *fakeStock) ProductIdsMatchingStock(_ context.Context, _ uuid.UUID, filter commerceports.StockFilter) ([]uuid.UUID, error) {
	stock.mutex.Lock()
	defer stock.mutex.Unlock()
	stock.lastLevel = filter.Level
	return stock.matching, nil
}

func (stock *fakeStock) ProvisionVariantStock(context.Context, commerceports.ProvisionVariantStockRequest) error {
	return nil
}

func (stock *fakeStock) SetProductListed(context.Context, uuid.UUID, uuid.UUID, bool) error {
	return nil
}

func (stock *fakeStock) EnsureDefaultLocation(context.Context, uuid.UUID, string) (uuid.UUID, error) {
	return uuid.New(), nil
}

type fakePurchases struct {
	mutex    sync.Mutex
	received map[uuid.UUID]map[uuid.UUID]bool
}

func (purchases *fakePurchases) grant(accountId, productId uuid.UUID) {
	purchases.mutex.Lock()
	defer purchases.mutex.Unlock()
	if purchases.received[accountId] == nil {
		purchases.received[accountId] = map[uuid.UUID]bool{}
	}
	purchases.received[accountId][productId] = true
}

func (purchases *fakePurchases) FindReceivedPurchaseOfProduct(_ context.Context, accountId, productId uuid.UUID) (string, bool, error) {
	purchases.mutex.Lock()
	defer purchases.mutex.Unlock()
	return "ZM-1001", purchases.received[accountId][productId], nil
}

func (purchases *fakePurchases) FindReceivedPurchaseFromStore(context.Context, uuid.UUID, uuid.UUID) (string, bool, error) {
	return "", false, nil
}

type fakeStoreFollows struct {
	followers map[uuid.UUID]int
}

func (follows *fakeStoreFollows) StoreFollowStats(_ context.Context, storeId uuid.UUID, viewer *uuid.UUID) (int, bool) {
	return follows.followers[storeId], viewer != nil && follows.followers[storeId] > 0
}

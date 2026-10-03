package commerceports

import "sync"

type Registry struct {
	mutex     sync.RWMutex
	catalog   CatalogReader
	inventory InventoryStock
	rewards   StoreRewardsLookup
	purchases PurchaseVerifier
}

var Default = &Registry{}

func (registry *Registry) RegisterCatalogReader(port CatalogReader) {
	registry.mutex.Lock()
	registry.catalog = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterInventoryStock(port InventoryStock) {
	registry.mutex.Lock()
	registry.inventory = port
	registry.mutex.Unlock()
}

func (registry *Registry) CatalogReader() (CatalogReader, error) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	if registry.catalog == nil {
		return nil, ErrPortNotRegistered
	}
	return registry.catalog, nil
}

func (registry *Registry) InventoryStock() (InventoryStock, error) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	if registry.inventory == nil {
		return nil, ErrPortNotRegistered
	}
	return registry.inventory, nil
}

func (registry *Registry) RegisterStoreRewardsLookup(port StoreRewardsLookup) {
	registry.mutex.Lock()
	registry.rewards = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterPurchaseVerifier(port PurchaseVerifier) {
	registry.mutex.Lock()
	registry.purchases = port
	registry.mutex.Unlock()
}

func (registry *Registry) StoreRewardsLookup() (StoreRewardsLookup, error) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	if registry.rewards == nil {
		return nil, ErrPortNotRegistered
	}
	return registry.rewards, nil
}

func (registry *Registry) PurchaseVerifier() (PurchaseVerifier, error) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	if registry.purchases == nil {
		return nil, ErrPortNotRegistered
	}
	return registry.purchases, nil
}

package commerceports

import "sync"

type Registry struct {
	mutex     sync.RWMutex
	catalog   CatalogReader
	inventory InventoryStock
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

package integrations

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

type InMemoryStoreCatalog struct {
	mutex       sync.Mutex
	members     map[[2]uuid.UUID]bool
	products    map[uuid.UUID]map[uuid.UUID]interfaces.StoreProduct
	Unavailable bool
}

func NewInMemoryStoreCatalog() *InMemoryStoreCatalog {
	return &InMemoryStoreCatalog{members: map[[2]uuid.UUID]bool{}, products: map[uuid.UUID]map[uuid.UUID]interfaces.StoreProduct{}}
}

func (catalog *InMemoryStoreCatalog) AddMember(storeId, userId uuid.UUID) {
	catalog.mutex.Lock()
	defer catalog.mutex.Unlock()
	catalog.members[[2]uuid.UUID{storeId, userId}] = true
}

func (catalog *InMemoryStoreCatalog) AddProduct(storeId uuid.UUID, product interfaces.StoreProduct) {
	catalog.mutex.Lock()
	defer catalog.mutex.Unlock()
	if catalog.products[storeId] == nil {
		catalog.products[storeId] = map[uuid.UUID]interfaces.StoreProduct{}
	}
	catalog.products[storeId][product.Id] = product
}

func (catalog *InMemoryStoreCatalog) SetUnavailable(unavailable bool) {
	catalog.mutex.Lock()
	defer catalog.mutex.Unlock()
	catalog.Unavailable = unavailable
}

func (catalog *InMemoryStoreCatalog) IsStoreMember(_ context.Context, storeId, userId uuid.UUID) (bool, error) {
	catalog.mutex.Lock()
	defer catalog.mutex.Unlock()
	if catalog.Unavailable {
		return false, ErrCatalogUnavailable
	}
	return catalog.members[[2]uuid.UUID{storeId, userId}], nil
}

func (catalog *InMemoryStoreCatalog) OwnedProducts(_ context.Context, storeId uuid.UUID, productIds []uuid.UUID) (map[uuid.UUID]interfaces.StoreProduct, error) {
	catalog.mutex.Lock()
	defer catalog.mutex.Unlock()
	if catalog.Unavailable {
		return nil, ErrCatalogUnavailable
	}
	owned := map[uuid.UUID]interfaces.StoreProduct{}
	for _, productId := range productIds {
		if product, found := catalog.products[storeId][productId]; found && product.Status != "archived" {
			owned[productId] = product
		}
	}
	return owned, nil
}

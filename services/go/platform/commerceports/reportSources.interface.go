package commerceports

import (
	"context"
	"sync"

	"github.com/google/uuid"
)

type StoreTaxRate struct {
	Id              string
	Name            string
	RateBasisPoints int
	IsDefault       bool
	CategoryIds     []uuid.UUID
}

type StoreTaxSettings struct {
	Rates            []StoreTaxRate
	PricesIncludeTax bool
}

type StoreTaxRatesReader interface {
	TaxSettingsForStore(ctx context.Context, storeId uuid.UUID) (StoreTaxSettings, error)
}

type StoreLocationNamesReader interface {
	LocationNamesForStore(ctx context.Context, storeId uuid.UUID) (map[uuid.UUID]string, error)
}

type reportSourcePorts struct {
	mutex     sync.RWMutex
	taxRates  StoreTaxRatesReader
	locations StoreLocationNamesReader
}

var reportSources = &reportSourcePorts{}

func (registry *Registry) RegisterStoreTaxRatesReader(port StoreTaxRatesReader) {
	reportSources.mutex.Lock()
	reportSources.taxRates = port
	reportSources.mutex.Unlock()
}

func (registry *Registry) StoreTaxRatesReader() (StoreTaxRatesReader, error) {
	reportSources.mutex.RLock()
	defer reportSources.mutex.RUnlock()
	if reportSources.taxRates == nil {
		return nil, ErrPortNotRegistered
	}
	return reportSources.taxRates, nil
}

func (registry *Registry) RegisterStoreLocationNamesReader(port StoreLocationNamesReader) {
	reportSources.mutex.Lock()
	reportSources.locations = port
	reportSources.mutex.Unlock()
}

func (registry *Registry) StoreLocationNamesReader() (StoreLocationNamesReader, error) {
	reportSources.mutex.RLock()
	defer reportSources.mutex.RUnlock()
	if reportSources.locations == nil {
		return nil, ErrPortNotRegistered
	}
	return reportSources.locations, nil
}

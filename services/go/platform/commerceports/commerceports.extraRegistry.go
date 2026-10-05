package commerceports

import "sync"

type extraPorts struct {
	mutex       sync.RWMutex
	rewardRules StoreRewardRulesReader
	auditTrail  StoreAuditTrail
	areas       DeliveryAreaNamesReader
	stockAlerts StoreStockAlertsReader
	insights    StoreInsightsReader
	auditReader StoreAuditReader
}

var extras = &extraPorts{}

func (registry *Registry) RegisterStoreRewardRulesReader(port StoreRewardRulesReader) {
	extras.mutex.Lock()
	extras.rewardRules = port
	extras.mutex.Unlock()
}

func (registry *Registry) StoreRewardRulesReader() (StoreRewardRulesReader, error) {
	extras.mutex.RLock()
	defer extras.mutex.RUnlock()
	if extras.rewardRules == nil {
		return nil, ErrPortNotRegistered
	}
	return extras.rewardRules, nil
}

func (registry *Registry) RegisterStoreAuditTrail(port StoreAuditTrail) {
	extras.mutex.Lock()
	extras.auditTrail = port
	extras.mutex.Unlock()
}

func (registry *Registry) StoreAuditTrail() (StoreAuditTrail, error) {
	extras.mutex.RLock()
	defer extras.mutex.RUnlock()
	if extras.auditTrail == nil {
		return nil, ErrPortNotRegistered
	}
	return extras.auditTrail, nil
}

func (registry *Registry) RegisterDeliveryAreaNamesReader(port DeliveryAreaNamesReader) {
	extras.mutex.Lock()
	extras.areas = port
	extras.mutex.Unlock()
}

func (registry *Registry) DeliveryAreaNamesReader() (DeliveryAreaNamesReader, error) {
	extras.mutex.RLock()
	defer extras.mutex.RUnlock()
	if extras.areas == nil {
		return nil, ErrPortNotRegistered
	}
	return extras.areas, nil
}

func (registry *Registry) RegisterStoreStockAlertsReader(port StoreStockAlertsReader) {
	extras.mutex.Lock()
	extras.stockAlerts = port
	extras.mutex.Unlock()
}

func (registry *Registry) StoreStockAlertsReader() (StoreStockAlertsReader, error) {
	extras.mutex.RLock()
	defer extras.mutex.RUnlock()
	if extras.stockAlerts == nil {
		return nil, ErrPortNotRegistered
	}
	return extras.stockAlerts, nil
}

func (registry *Registry) RegisterStoreInsightsReader(port StoreInsightsReader) {
	extras.mutex.Lock()
	extras.insights = port
	extras.mutex.Unlock()
}

func (registry *Registry) StoreInsightsReader() (StoreInsightsReader, error) {
	extras.mutex.RLock()
	defer extras.mutex.RUnlock()
	if extras.insights == nil {
		return nil, ErrPortNotRegistered
	}
	return extras.insights, nil
}

func (registry *Registry) RegisterStoreAuditReader(port StoreAuditReader) {
	extras.mutex.Lock()
	extras.auditReader = port
	extras.mutex.Unlock()
}

func (registry *Registry) StoreAuditReader() (StoreAuditReader, error) {
	extras.mutex.RLock()
	defer extras.mutex.RUnlock()
	if extras.auditReader == nil {
		return nil, ErrPortNotRegistered
	}
	return extras.auditReader, nil
}

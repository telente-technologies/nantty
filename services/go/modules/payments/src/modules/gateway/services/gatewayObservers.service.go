package services

import (
	"context"
	"database/sql"
	"sync"

	"nantty/modules/payments/src/modules/gateway/models"
)

type gatewayObservers struct {
	mutex        sync.RWMutex
	billing      []models.BillingSubscriptionObserver
	savedCards   []models.SavedCardObserver
	storeNotices []models.StoreSubscriptionNotificationHandler
}

func (gateway *PaymentGateway) RegisterBillingSubscriptionObserver(observer models.BillingSubscriptionObserver) {
	gateway.observers.mutex.Lock()
	defer gateway.observers.mutex.Unlock()
	gateway.observers.billing = append(gateway.observers.billing, observer)
}

func (gateway *PaymentGateway) RegisterSavedCardObserver(observer models.SavedCardObserver) {
	gateway.observers.mutex.Lock()
	defer gateway.observers.mutex.Unlock()
	gateway.observers.savedCards = append(gateway.observers.savedCards, observer)
}

func (gateway *PaymentGateway) RegisterStoreSubscriptionNotificationHandler(handler models.StoreSubscriptionNotificationHandler) {
	gateway.observers.mutex.Lock()
	defer gateway.observers.mutex.Unlock()
	gateway.observers.storeNotices = append(gateway.observers.storeNotices, handler)
}

func (gateway *PaymentGateway) notifyBillingObservers(ctx context.Context, transaction *sql.Tx, change models.BillingSubscriptionChange) error {
	gateway.observers.mutex.RLock()
	observers := append([]models.BillingSubscriptionObserver{}, gateway.observers.billing...)
	gateway.observers.mutex.RUnlock()
	for _, observer := range observers {
		if err := observer.HandleBillingSubscriptionChanged(ctx, transaction, change); err != nil {
			return err
		}
	}
	return nil
}

func (gateway *PaymentGateway) notifySavedCardObservers(ctx context.Context, transaction *sql.Tx, card models.SavedCardFingerprint) error {
	gateway.observers.mutex.RLock()
	observers := append([]models.SavedCardObserver{}, gateway.observers.savedCards...)
	gateway.observers.mutex.RUnlock()
	for _, observer := range observers {
		if err := observer.HandleSavedCardFingerprint(ctx, transaction, card); err != nil {
			return err
		}
	}
	return nil
}

func (gateway *PaymentGateway) notifyStoreSubscriptionHandlers(ctx context.Context, transaction *sql.Tx, notice models.StoreSubscriptionNotice) error {
	gateway.observers.mutex.RLock()
	handlers := append([]models.StoreSubscriptionNotificationHandler{}, gateway.observers.storeNotices...)
	gateway.observers.mutex.RUnlock()
	for _, handler := range handlers {
		if err := handler.HandleStoreSubscriptionNotice(ctx, transaction, notice); err != nil {
			return err
		}
	}
	return nil
}

package services

import (
	"errors"
	"fmt"
	"net/http"
	"sync"

	"zudomart/modules/payments/src/container"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

type PaymentGateway struct {
	Container        *container.Container
	mutex            sync.RWMutex
	purposeHandlers  map[string]models.PaymentPurposeHandler
	transferHandlers map[string]models.TransferOutcomeHandler
	refundHandlers   map[string]models.StoreRefundHandler
}

func NewPaymentGateway(container *container.Container) *PaymentGateway {
	return &PaymentGateway{
		Container:        container,
		purposeHandlers:  map[string]models.PaymentPurposeHandler{},
		transferHandlers: map[string]models.TransferOutcomeHandler{},
		refundHandlers:   map[string]models.StoreRefundHandler{},
	}
}

func (gateway *PaymentGateway) RegisterPaymentPurposeHandler(purpose string, handler models.PaymentPurposeHandler) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.purposeHandlers[purpose] = handler
}

func (gateway *PaymentGateway) RegisterTransferOutcomeHandler(purpose string, handler models.TransferOutcomeHandler) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.transferHandlers[purpose] = handler
}

func (gateway *PaymentGateway) RegisterStoreRefundHandler(purpose string, handler models.StoreRefundHandler) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.refundHandlers[purpose] = handler
}

func (gateway *PaymentGateway) purposeHandler(purpose string) (models.PaymentPurposeHandler, error) {
	gateway.mutex.RLock()
	defer gateway.mutex.RUnlock()
	handler, found := gateway.purposeHandlers[purpose]
	if !found {
		return nil, fmt.Errorf("no payment handler registered for purpose %q", purpose)
	}
	return handler, nil
}

func (gateway *PaymentGateway) transferHandler(purpose string) (models.TransferOutcomeHandler, error) {
	gateway.mutex.RLock()
	defer gateway.mutex.RUnlock()
	handler, found := gateway.transferHandlers[purpose]
	if !found {
		return nil, fmt.Errorf("no transfer handler registered for purpose %q", purpose)
	}
	return handler, nil
}

func (gateway *PaymentGateway) storeRefundHandler(purpose string) (models.StoreRefundHandler, error) {
	gateway.mutex.RLock()
	defer gateway.mutex.RUnlock()
	handler, found := gateway.refundHandlers[purpose]
	if !found {
		return nil, fmt.Errorf("no store refund handler registered for purpose %q", purpose)
	}
	return handler, nil
}

var (
	sharedGatewayMutex sync.RWMutex
	sharedGateway      *PaymentGateway
)

func PublishSharedPaymentGateway(gateway *PaymentGateway) {
	sharedGatewayMutex.Lock()
	defer sharedGatewayMutex.Unlock()
	sharedGateway = gateway
}

func SharedPaymentGateway() (*PaymentGateway, error) {
	sharedGatewayMutex.RLock()
	defer sharedGatewayMutex.RUnlock()
	if sharedGateway == nil {
		return nil, errors.New("the payments module must start before modules that use the payment gateway")
	}
	return sharedGateway, nil
}

var (
	ErrPaymentNotFound          = httpserver.NewApiError(http.StatusNotFound, "PAYMENT_NOT_FOUND", "Payment was not found.")
	ErrPaymentAmountMismatch    = httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_AMOUNT_MISMATCH", "The amount paid does not match this payment.")
	ErrCurrencyNotSupported     = httpserver.NewApiError(http.StatusUnprocessableEntity, "CURRENCY_NOT_SUPPORTED", "This payment provider cannot charge in this currency. Choose another provider.")
	ErrProviderUnavailable      = httpserver.NewApiError(http.StatusBadGateway, "PAYMENT_PROVIDER_UNAVAILABLE", "The payment provider could not complete the request. Try again shortly.")
	ErrRefundExceedsPayment     = httpserver.NewApiError(http.StatusConflict, "REFUND_EXCEEDS_PAYMENT", "This payment has already been refunded.")
	ErrPaymentNotRefundable     = httpserver.NewApiError(http.StatusConflict, "PAYMENT_NOT_REFUNDABLE", "Only a completed payment can be refunded.")
	ErrStoreReceiptRedeemedByOther = httpserver.NewApiError(http.StatusConflict, "STORE_RECEIPT_ALREADY_REDEEMED", "This purchase receipt was already redeemed by another account.")
	ErrStoreReceiptInvalid      = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_RECEIPT_INVALID", "This purchase receipt could not be verified.")
	ErrStoreNotConfigured       = httpserver.NewApiError(http.StatusNotImplemented, "IAP_NOT_CONFIGURED", "In-app purchases are not configured yet.")
)

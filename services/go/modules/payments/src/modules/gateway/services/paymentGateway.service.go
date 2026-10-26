package services

import (
	"errors"
	"fmt"
	"net/http"
	"sync"

	"nantty/modules/payments/src/container"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/platform/httpserver"
)

type PaymentGateway struct {
	Container        *container.Container
	mutex            sync.RWMutex
	purposeHandlers  map[string]models.PaymentPurposeHandler
	transferHandlers map[string]models.TransferOutcomeHandler
	refundHandlers   map[string]models.StoreRefundHandler
	disputeHandlers  map[string]models.ProviderDisputeHandler
	movementHandlers map[string]models.MovementOutcomeHandler
	observers        gatewayObservers
}

func NewPaymentGateway(container *container.Container) *PaymentGateway {
	gateway := &PaymentGateway{
		Container:        container,
		purposeHandlers:  map[string]models.PaymentPurposeHandler{},
		transferHandlers: map[string]models.TransferOutcomeHandler{},
		refundHandlers:   map[string]models.StoreRefundHandler{},
		disputeHandlers:  map[string]models.ProviderDisputeHandler{},
		movementHandlers: map[string]models.MovementOutcomeHandler{},
	}
	gateway.registerWalletMovementHandlers()
	return gateway
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

func (gateway *PaymentGateway) RegisterProviderDisputeHandler(purpose string, handler models.ProviderDisputeHandler) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.disputeHandlers[purpose] = handler
}

func (gateway *PaymentGateway) RegisterMovementOutcomeHandler(kind string, handler models.MovementOutcomeHandler) {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	gateway.movementHandlers[kind] = handler
}

func (gateway *PaymentGateway) movementHandler(kind string) (models.MovementOutcomeHandler, error) {
	gateway.mutex.RLock()
	defer gateway.mutex.RUnlock()
	handler, found := gateway.movementHandlers[kind]
	if !found {
		return nil, fmt.Errorf("no movement handler registered for kind %q", kind)
	}
	return handler, nil
}

func (gateway *PaymentGateway) disputeHandler(purpose string) (models.ProviderDisputeHandler, bool) {
	gateway.mutex.RLock()
	defer gateway.mutex.RUnlock()
	handler, found := gateway.disputeHandlers[purpose]
	return handler, found
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
	ErrPaymentNotFound             = httpserver.NewApiError(http.StatusNotFound, "PAYMENT_NOT_FOUND", "Payment was not found.")
	ErrCheckoutOpening             = httpserver.NewApiError(http.StatusConflict, "CHECKOUT_OPENING", "The checkout link is being created. Try again in a moment.")
	ErrPaymentAmountMismatch       = httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_AMOUNT_MISMATCH", "The amount paid does not match this payment.")
	ErrCurrencyNotSupported        = httpserver.NewApiError(http.StatusUnprocessableEntity, "CURRENCY_NOT_SUPPORTED", "Payments in this currency are not supported yet.")
	ErrVerifyEmailRequired         = httpserver.NewApiError(http.StatusForbidden, "VERIFY_EMAIL_REQUIRED", "Verify your email to continue.")
	ErrSellerNotReadyForPayments   = httpserver.NewApiError(http.StatusConflict, "SELLER_NOT_READY_FOR_PAYMENTS", "This store cannot take payments yet.")
	ErrConnectedAccountMissing     = httpserver.NewApiError(http.StatusConflict, "PAYOUT_ACCOUNT_NOT_SET_UP", "Finish payout verification before continuing.")
	ErrPayoutsFrozen               = httpserver.NewApiError(http.StatusConflict, "PAYOUTS_ON_HOLD", "Payouts for this account are on hold while we check its balance.")
	ErrProviderBalanceTooLow       = httpserver.NewApiError(http.StatusConflict, "PROVIDER_BALANCE_TOO_LOW", "There is not enough settled money to complete this right now.")
	ErrProviderUnavailable         = httpserver.NewApiError(http.StatusBadGateway, "PAYMENT_PROVIDER_UNAVAILABLE", "The payment provider could not complete the request. Try again shortly.")
	ErrRefundExceedsPayment        = httpserver.NewApiError(http.StatusConflict, "REFUND_EXCEEDS_PAYMENT", "This payment has already been refunded.")
	ErrPaymentNotRefundable        = httpserver.NewApiError(http.StatusConflict, "PAYMENT_NOT_REFUNDABLE", "Only a completed payment can be refunded.")
	ErrStoreReceiptRedeemedByOther = httpserver.NewApiError(http.StatusConflict, "STORE_RECEIPT_ALREADY_REDEEMED", "This purchase receipt was already redeemed by another account.")
	ErrStoreReceiptInvalid         = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_RECEIPT_INVALID", "This purchase receipt could not be verified.")
	ErrStoreNotConfigured          = httpserver.NewApiError(http.StatusNotImplemented, "IAP_NOT_CONFIGURED", "In-app purchases are not configured yet.")
)

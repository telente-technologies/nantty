package services

import (
	"context"
	"errors"
	"net/http"

	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/httpserver"
)

var ErrStoreRefundNotSupported = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_REFUND_NOT_SUPPORTED", "This store does not let us refund the purchase for you.")

type storeSubscriptionRevoker interface {
	RevokeSubscriptionWithFullRefund(ctx context.Context, purchaseToken string) error
}

// RefundBillingSubscriptionCharge returns the whole first payment of a Paystack-billed subscription and stops it
// renewing. A definitive provider rejection is returned as is so the caller can alert instead of retrying.
func (gateway *PaymentGateway) RefundBillingSubscriptionCharge(ctx context.Context, billingReference, reason string) (interfaces.RefundResult, error) {
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	result, err := provider.RefundCharge(ctx, interfaces.RefundRequest{ChargeReference: billingReference, FullRefund: true, Reason: reason})
	if err != nil {
		return result, err
	}
	if cancelErr := gateway.CancelBillingSubscription(ctx, billingReference); cancelErr != nil && !errors.Is(cancelErr, ErrPaymentNotFound) {
		return result, cancelErr
	}
	return result, nil
}

func IsDefinitiveProviderRejection(err error) bool {
	var requestError *integrations.ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}

func (gateway *PaymentGateway) RevokeStoreSubscriptionWithRefund(ctx context.Context, store, purchaseToken string) error {
	if store != constants.StoreGooglePlay {
		return ErrStoreRefundNotSupported
	}
	verifier, err := gateway.Container.StoreVerifier(store)
	if err != nil {
		return err
	}
	revoker, supported := verifier.(storeSubscriptionRevoker)
	if !supported {
		return ErrStoreRefundNotSupported
	}
	return revoker.RevokeSubscriptionWithFullRefund(ctx, purchaseToken)
}

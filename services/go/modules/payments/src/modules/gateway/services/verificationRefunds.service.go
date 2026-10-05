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

func (gateway *PaymentGateway) RefundBillingSubscriptionCharge(ctx context.Context, billingReference, reference, reason string) (interfaces.RefundResult, error) {
	if reference == "" {
		return interfaces.RefundResult{}, errors.New("a refund needs an idempotency reference")
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	result, err := gateway.refundBillingChargeOnce(ctx, provider, interfaces.RefundRequest{ChargeReference: billingReference, RefundReference: reference, FullRefund: true, Reason: reason}, nil)
	if err != nil {
		return result, err
	}
	if cancelErr := gateway.CancelBillingSubscription(ctx, billingReference); cancelErr != nil && !errors.Is(cancelErr, ErrPaymentNotFound) {
		return result, cancelErr
	}
	return result, nil
}

func IsDefinitiveProviderRejection(err error) bool {
	if errors.Is(err, errBillingRefundRejected) {
		return true
	}
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

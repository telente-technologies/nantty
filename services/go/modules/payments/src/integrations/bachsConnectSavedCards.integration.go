package integrations

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

var savedCardErrorsThatNeedHostedCheckout = map[string]bool{
	"PAYMENT_METHOD_UNUSABLE": true, "OFF_SESSION_NOT_SUPPORTED": true, "NO_SAVED_PAYMENT_METHOD": true,
	"AUTHENTICATION_REQUIRED": true, "CARD_DECLINED": true, "PAYMENT_METHOD_NOT_ENABLED": true,
}

func (provider *BachsConnectProvider) CreateCustomer(ctx context.Context, request interfaces.ProviderCustomerRequest) (string, error) {
	if request.Email == "" {
		return "", errors.New("bachs: a customer needs the verified account email")
	}
	var response struct {
		CustomerId string `json:"customer_id"`
		Id         string `json:"id"`
	}
	body := map[string]any{"email": request.Email, "name": request.Name}
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/customers", body: body, idempotencyKey: request.IdempotencyKey}, &response); err != nil {
		return "", err
	}
	customerId := response.CustomerId
	if customerId == "" {
		customerId = response.Id
	}
	if !strings.HasPrefix(customerId, "cust_") {
		return "", fmt.Errorf("%w: bachs returned no customer id", interfaces.ErrProviderUnavailable)
	}
	return customerId, nil
}

func (provider *BachsConnectProvider) CreateSaveCardCheckout(ctx context.Context, request interfaces.SaveCardCheckoutRequest) (interfaces.ChargeSession, error) {
	if request.ProviderCustomerId == "" {
		return interfaces.ChargeSession{}, errors.New("bachs: saving a card needs a customer")
	}
	body := map[string]any{
		"save_payment_method": true, "customer": map[string]any{"customer_id": request.ProviderCustomerId},
		"success_url": request.SuccessUrl, "cancel_url": request.CancelUrl, "reference": request.Reference, "metadata": request.Metadata,
	}
	var response bachsCheckoutSessionResponse
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/checkout-sessions", body: body, idempotencyKey: request.IdempotencyKey}, &response); err != nil {
		return interfaces.ChargeSession{}, err
	}
	if response.CheckoutUrl == "" {
		return interfaces.ChargeSession{}, fmt.Errorf("%w: bachs returned no checkout url", interfaces.ErrProviderUnavailable)
	}
	return interfaces.ChargeSession{CheckoutUrl: response.CheckoutUrl, ProviderCheckoutId: response.CheckoutId, ExpiresAt: optionalTime(response.ExpiresAt)}, nil
}

func (provider *BachsConnectProvider) ChargeSavedCard(ctx context.Context, request interfaces.SavedCardChargeRequest) (interfaces.SavedCardChargeResult, error) {
	if !strings.HasPrefix(request.PaymentMethodId, "pm_") || !strings.HasPrefix(request.ProviderCustomerId, "cust_") || request.IdempotencyKey == "" {
		return interfaces.SavedCardChargeResult{}, interfaces.ErrSavedCardNotForCustomer
	}
	amount, err := decimalAmount(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.SavedCardChargeResult{}, err
	}
	body := map[string]any{
		"customer": request.ProviderCustomerId, "payment_method": request.PaymentMethodId, "amount": amount, "currency": request.Currency,
		"reference": request.Reference, "description": truncate(request.Description, 200),
	}
	var response struct {
		PaymentId string `json:"payment_id"`
		Status    string `json:"status"`
	}
	err = provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/charges", body: body, connectedAccountId: request.ConnectedAccountId, idempotencyKey: request.IdempotencyKey}, &response)
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && requestError.IsDefinitiveRejection() {
		switch {
		case requestError.ErrorCode == "SAVED_PAYMENT_METHOD_NOT_FOUND" || requestError.ErrorCode == "NOT_FOUND":
			return interfaces.SavedCardChargeResult{}, interfaces.ErrSavedCardNotForCustomer
		case savedCardErrorsThatNeedHostedCheckout[requestError.ErrorCode]:
			return interfaces.SavedCardChargeResult{Outcome: interfaces.OutcomeFailed, RequiresHostedCheckout: true, FailureReason: requestError.ErrorCode}, nil
		}
	}
	if err != nil {
		return interfaces.SavedCardChargeResult{}, err
	}
	result := interfaces.SavedCardChargeResult{ProviderChargeId: response.PaymentId, Outcome: interfaces.OutcomePending}
	switch response.Status {
	case "succeeded":
		result.Outcome = interfaces.OutcomeSucceeded
	case "failed":
		result.Outcome, result.RequiresHostedCheckout, result.FailureReason = interfaces.OutcomeFailed, true, "charge failed"
	}
	return result, nil
}

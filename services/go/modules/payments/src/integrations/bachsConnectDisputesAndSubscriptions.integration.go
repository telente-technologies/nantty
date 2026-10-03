package integrations

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

func (provider *BachsConnectProvider) ListOpenDisputes(ctx context.Context, connectedAccountId string) ([]interfaces.ProviderDispute, error) {
	var disputes []interfaces.ProviderDispute
	for _, status := range []string{"needs_response", "under_review"} {
		var response struct {
			Items []struct {
				DisputeId          string  `json:"dispute_id"`
				ChargeId           string  `json:"charge_id"`
				Amount             *string `json:"amount"`
				Currency           string  `json:"currency"`
				Status             string  `json:"status"`
				Reason             *string `json:"reason"`
				ResponseDeadlineAt *string `json:"response_deadline_at"`
			} `json:"items"`
		}
		query := url.Values{"status": {status}, "limit": {"100"}}
		if err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/disputes", query: query, connectedAccountId: connectedAccountId}, &response); err != nil {
			return nil, err
		}
		for _, item := range response.Items {
			currency := strings.ToUpper(item.Currency)
			disputes = append(disputes, interfaces.ProviderDispute{
				ProviderDisputeId: item.DisputeId, ProviderChargeId: item.ChargeId, ConnectedAccountId: connectedAccountId,
				AmountMinor: minorAmount(item.Amount, currency), Currency: currency, Status: item.Status, Reason: stringValue(item.Reason),
				ResponseDeadlineAt: optionalTime(item.ResponseDeadlineAt),
			})
		}
	}
	return disputes, nil
}

func (provider *BachsConnectProvider) SubmitDisputeEvidence(ctx context.Context, evidence interfaces.DisputeEvidence) error {
	path := "/v1/disputes/" + url.PathEscape(evidence.ProviderDisputeId)
	body := map[string]any{
		"customer_name": evidence.CustomerName, "customer_email_address": evidence.CustomerEmail,
		"product_description": truncate(evidence.ProductDescription, 500), "notes": truncate(evidence.Notes, 2000),
	}
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodPatch, path: path + "/evidence", body: body, connectedAccountId: evidence.ConnectedAccountId, idempotencyKey: evidence.IdempotencyKey + ":evidence"}, nil); err != nil {
		return err
	}
	return provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: path + "/submit", body: map[string]any{}, connectedAccountId: evidence.ConnectedAccountId, idempotencyKey: evidence.IdempotencyKey + ":submit"}, nil)
}

func (provider *BachsConnectProvider) CreateRecurringPlan(ctx context.Context, request interfaces.RecurringPlanRequest) (string, error) {
	amount, err := decimalAmount(request.AmountMinor, request.Currency)
	if err != nil {
		return "", err
	}
	body := map[string]any{
		"name":          request.Name,
		"price":         map[string]any{"price_type": "fixed", "amount": amount, "currency": request.Currency},
		"billing_cycle": map[string]any{"interval": request.BillingIntervalUnit, "frequency": max(request.BillingIntervalSize, 1)},
	}
	if request.TrialDays > 0 {
		body["trial_period"] = map[string]any{"interval": "day", "frequency": request.TrialDays}
	}
	var response struct {
		Id string `json:"id"`
	}
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/products", body: body, idempotencyKey: request.IdempotencyKey}, &response); err != nil {
		return "", err
	}
	if response.Id == "" {
		return "", fmt.Errorf("%w: bachs returned no product id", interfaces.ErrProviderUnavailable)
	}
	return response.Id, nil
}

func (provider *BachsConnectProvider) CreateSubscriptionCheckout(ctx context.Context, request interfaces.SubscriptionCheckoutRequest) (interfaces.ChargeSession, error) {
	if request.ProviderProductId == "" || request.CustomerEmail == "" {
		return interfaces.ChargeSession{}, errors.New("bachs: a subscription checkout needs a product and a customer email")
	}
	body := map[string]any{
		"product_cart": []map[string]any{{"product_id": request.ProviderProductId, "quantity": 1}},
		"customer":     map[string]any{"email": request.CustomerEmail, "name": request.CustomerName},
		"success_url":  request.SuccessUrl, "cancel_url": request.CancelUrl, "reference": request.Reference, "metadata": request.Metadata,
		"payment_method_types": []string{"USD_CARD", "NGN_CARD"},
	}
	if request.ProviderCustomerId != "" {
		body["customer"] = map[string]any{"customer_id": request.ProviderCustomerId}
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

func (provider *BachsConnectProvider) CancelSubscription(ctx context.Context, providerSubscriptionId, idempotencyKey string) error {
	return provider.http.send(ctx, bachsRequest{method: http.MethodDelete, path: "/v1/subscriptions/" + url.PathEscape(providerSubscriptionId), idempotencyKey: idempotencyKey}, nil)
}

func (provider *BachsConnectProvider) ScheduleSubscriptionCancellation(ctx context.Context, request interfaces.SubscriptionCancellationRequest) error {
	body := map[string]any{"cancel_at_period_end": request.AtPeriodEnd, "reason": truncate(request.Reason, 255)}
	return provider.http.send(ctx, bachsRequest{method: http.MethodDelete, path: "/v1/subscriptions/" + url.PathEscape(request.ProviderSubscriptionId), body: body, idempotencyKey: request.IdempotencyKey}, nil)
}

func (provider *BachsConnectProvider) ChangeSubscriptionProduct(ctx context.Context, request interfaces.SubscriptionProductChange) error {
	proration := request.ProrationBehavior
	if proration == "" {
		proration = "none"
	}
	body := map[string]any{"product_id": request.ProviderProductId, "proration_behavior": proration}
	return provider.http.send(ctx, bachsRequest{method: http.MethodPatch, path: "/v1/subscriptions/" + url.PathEscape(request.ProviderSubscriptionId), body: body, idempotencyKey: request.IdempotencyKey}, nil)
}

package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

func (provider *PaystackProvider) CreateRecurringPlan(ctx context.Context, request interfaces.RecurringPlanRequest) (string, error) {
	body := map[string]any{"name": request.Name, "amount": request.AmountMinor, "currency": request.Currency, "interval": request.Interval, "send_invoices": true}
	var plan struct {
		PlanCode string `json:"plan_code"`
	}
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/plan", body: body}, &plan); err != nil {
		return "", err
	}
	if !strings.HasPrefix(plan.PlanCode, "PLN_") {
		return "", fmt.Errorf("%w: paystack returned no plan code", interfaces.ErrProviderUnavailable)
	}
	return plan.PlanCode, nil
}

func (provider *PaystackProvider) CreateSubscription(ctx context.Context, request interfaces.SubscriptionRequest) (interfaces.ProviderSubscription, error) {
	body := map[string]any{"customer": request.ProviderCustomerId, "plan": request.PlanCode}
	if request.StartDate != nil {
		body["start_date"] = request.StartDate.UTC().Format(time.RFC3339)
	}
	var subscription struct {
		SubscriptionCode string  `json:"subscription_code"`
		EmailToken       string  `json:"email_token"`
		Status           string  `json:"status"`
		NextPaymentDate  *string `json:"next_payment_date"`
	}
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/subscription", body: body}, &subscription); err != nil {
		return interfaces.ProviderSubscription{}, err
	}
	return interfaces.ProviderSubscription{SubscriptionCode: subscription.SubscriptionCode, EmailToken: subscription.EmailToken, Status: subscription.Status, NextPaymentAt: optionalTime(subscription.NextPaymentDate)}, nil
}

func (provider *PaystackProvider) DisableSubscription(ctx context.Context, subscriptionCode, emailToken string) error {
	body := map[string]any{"code": subscriptionCode, "token": emailToken}
	return provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/subscription/disable", body: body, retrySafe: true}, nil)
}

type paystackDispute struct {
	Id           json.Number `json:"id"`
	Status       string      `json:"status"`
	Currency     string      `json:"currency"`
	Category     string      `json:"category"`
	RefundAmount json.Number `json:"refund_amount"`
	DueAt        *string     `json:"dueAt"`
	Transaction  *struct {
		Id        json.Number `json:"id"`
		Reference string      `json:"reference"`
		Amount    json.Number `json:"amount"`
	} `json:"transaction"`
}

func (dispute paystackDispute) toProviderDispute() interfaces.ProviderDispute {
	converted := interfaces.ProviderDispute{
		ProviderDisputeId: dispute.Id.String(), Currency: strings.ToUpper(dispute.Currency), Status: PaystackDisputeOutcome("", dispute.Status, ""), Reason: dispute.Category,
		ResponseDeadlineAt: optionalTime(dispute.DueAt),
	}
	if dispute.Transaction != nil {
		converted.ProviderChargeId, converted.ChargeReference = dispute.Transaction.Id.String(), dispute.Transaction.Reference
		converted.AmountMinor = numberValue(dispute.Transaction.Amount)
	}
	if refund := numberValue(dispute.RefundAmount); refund > 0 {
		converted.AmountMinor = refund
	}
	return converted
}

func (provider *PaystackProvider) ListOpenDisputes(ctx context.Context) ([]interfaces.ProviderDispute, error) {
	var disputes []interfaces.ProviderDispute
	for _, status := range []string{"awaiting-merchant-feedback", "awaiting-bank-feedback", "pending"} {
		var page paystackPage[paystackDispute]
		if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/dispute", query: url.Values{"status": {status}, "perPage": {"100"}}}, &page); err != nil {
			return nil, err
		}
		for _, dispute := range page.Items {
			disputes = append(disputes, dispute.toProviderDispute())
		}
	}
	return disputes, nil
}

func (provider *PaystackProvider) SubmitDisputeEvidence(ctx context.Context, evidence interfaces.DisputeEvidence) error {
	body := map[string]any{
		"customer_email": evidence.CustomerEmail, "customer_name": evidence.CustomerName, "customer_phone": "",
		"service_details": truncate(evidence.ProductDescription+"\n"+evidence.Notes, 2000),
	}
	return provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/dispute/" + url.PathEscape(evidence.ProviderDisputeId) + "/evidence", body: body}, nil)
}

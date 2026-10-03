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

type bachsCheckoutSessionResponse struct {
	CheckoutId  string  `json:"checkout_id"`
	CheckoutUrl string  `json:"checkout_url"`
	Status      string  `json:"status"`
	ExpiresAt   *string `json:"expires_at"`
	Reference   *string `json:"reference"`
}

func (provider *BachsConnectProvider) InitializeCharge(ctx context.Context, request interfaces.ChargeRequest) (interfaces.ChargeSession, error) {
	amount, err := decimalAmount(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.ChargeSession{}, err
	}
	body := map[string]any{
		"pricing":           map[string]any{"currency": request.Currency, "amount": amount},
		"customer":          map[string]any{"email": request.CustomerEmail, "name": request.CustomerName},
		"success_url":       request.SuccessUrl,
		"cancel_url":        request.CancelUrl,
		"reference":         request.Reference,
		"metadata":          request.Metadata,
		"customer_creation": "if_required",
	}
	if request.ExpiresInMinutes > 0 {
		body["expires_in_minutes"] = min(request.ExpiresInMinutes, 1440)
	}
	if request.PlatformFeeMinor > 0 {
		if request.ConnectedAccountId == "" || request.PlatformFeeMinor >= request.AmountMinor {
			return interfaces.ChargeSession{}, errors.New("bachs: a platform fee needs a connected account and must be below the gross amount")
		}
		fee, err := decimalAmount(request.PlatformFeeMinor, request.Currency)
		if err != nil {
			return interfaces.ChargeSession{}, err
		}
		body["platform_fee"] = fee
	}
	var response bachsCheckoutSessionResponse
	err = provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/checkout-sessions", body: body, connectedAccountId: request.ConnectedAccountId, idempotencyKey: request.IdempotencyKey}, &response)
	if err != nil {
		return interfaces.ChargeSession{}, err
	}
	if response.CheckoutUrl == "" || response.CheckoutId == "" {
		return interfaces.ChargeSession{}, fmt.Errorf("%w: bachs returned no checkout url", interfaces.ErrProviderUnavailable)
	}
	return interfaces.ChargeSession{CheckoutUrl: response.CheckoutUrl, ProviderCheckoutId: response.CheckoutId, ExpiresAt: optionalTime(response.ExpiresAt)}, nil
}

type bachsCheckoutSessionDetail struct {
	CheckoutId    string  `json:"checkout_id"`
	Status        string  `json:"status"`
	PaymentStatus *string `json:"payment_status"`
	Amount        *string `json:"amount"`
	Currency      string  `json:"currency"`
	Reference     *string `json:"reference"`
	PlatformFee   *string `json:"platform_fee"`
	Charge        *struct {
		PaymentId string  `json:"payment_id"`
		Status    string  `json:"status"`
		Amount    *string `json:"amount"`
		Currency  string  `json:"currency"`
		Fees      *struct {
			Amount   *string `json:"amount"`
			Currency string  `json:"currency"`
		} `json:"fees"`
	} `json:"charge"`
}

func (provider *BachsConnectProvider) VerifyCharge(ctx context.Context, lookup interfaces.ChargeLookup) (interfaces.ChargeVerification, error) {
	if lookup.ProviderCheckoutId == "" {
		return interfaces.ChargeVerification{Reference: lookup.Reference, Outcome: interfaces.OutcomePending}, nil
	}
	var detail bachsCheckoutSessionDetail
	err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/checkout-sessions/" + url.PathEscape(lookup.ProviderCheckoutId), connectedAccountId: lookup.ConnectedAccountId}, &detail)
	if err != nil {
		return interfaces.ChargeVerification{}, err
	}
	return convertBachsCheckoutDetail(lookup.Reference, detail), nil
}

func convertBachsCheckoutDetail(reference string, detail bachsCheckoutSessionDetail) interfaces.ChargeVerification {
	currency := strings.ToUpper(detail.Currency)
	verification := interfaces.ChargeVerification{Reference: reference, Outcome: interfaces.OutcomePending, Currency: currency, AmountMinor: minorAmount(detail.Amount, currency), PlatformFeeMinor: minorAmount(detail.PlatformFee, currency)}
	if detail.Reference != nil && *detail.Reference != "" {
		verification.Reference = *detail.Reference
	}
	if detail.Charge != nil {
		chargeCurrency := strings.ToUpper(detail.Charge.Currency)
		verification.ProviderChargeId = detail.Charge.PaymentId
		verification.Currency = chargeCurrency
		verification.AmountMinor = minorAmount(detail.Charge.Amount, chargeCurrency)
		if detail.Charge.Fees != nil {
			verification.ProviderFeeMinor = minorAmount(detail.Charge.Fees.Amount, strings.ToUpper(detail.Charge.Fees.Currency))
		}
	}
	paymentStatus := ""
	if detail.PaymentStatus != nil {
		paymentStatus = *detail.PaymentStatus
	}
	switch {
	case detail.Status == "completed" && (paymentStatus == "succeeded" || paymentStatus == "" || paymentStatus == "paid"):
		verification.Outcome = interfaces.OutcomeSucceeded
	case detail.Status == "expired" || detail.Status == "cancelled" || paymentStatus == "failed" || paymentStatus == "canceled":
		verification.Outcome = interfaces.OutcomeFailed
		verification.FailureReason = "checkout " + detail.Status + " " + paymentStatus
	}
	return verification
}

type bachsRefundResponse struct {
	RefundId string `json:"refund_id"`
	Status   string `json:"status"`
}

func (provider *BachsConnectProvider) RefundCharge(ctx context.Context, request interfaces.RefundRequest) (interfaces.RefundResult, error) {
	if request.ProviderChargeId == "" {
		return interfaces.RefundResult{}, errors.New("bachs: a refund needs the provider charge id")
	}
	body := map[string]any{"charge_id": request.ProviderChargeId, "reference": request.RefundReference, "reason": truncate(request.Reason, 250), "idempotency_key": request.IdempotencyKey}
	if !request.FullRefund {
		amount, err := decimalAmount(request.AmountMinor, request.Currency)
		if err != nil {
			return interfaces.RefundResult{}, err
		}
		body["amount"] = amount
	}
	var response bachsRefundResponse
	err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/refunds", body: body, connectedAccountId: request.ConnectedAccountId, idempotencyKey: request.IdempotencyKey}, &response)
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: response.RefundId, Outcome: convertBachsRefundStatus(response.Status)}, nil
}

func convertBachsRefundStatus(status string) interfaces.ProviderOutcome {
	switch status {
	case "success", "paid", "succeeded":
		return interfaces.OutcomeSucceeded
	case "failed":
		return interfaces.OutcomeFailed
	}
	return interfaces.OutcomePending
}

func (provider *BachsConnectProvider) ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	var response struct {
		Resolved    bool   `json:"resolved"`
		AccountName string `json:"account_name"`
	}
	body := map[string]any{"account_number": accountNumber, "bank_code": bankCode, "country": "NG"}
	err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/misc/bank-accounts/resolve", body: body, idempotencyKey: "resolve:" + bankCode + ":" + accountNumber}, &response)
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && requestError.IsDefinitiveRejection() {
		return "", interfaces.ErrBankAccountNotFound
	}
	if err != nil {
		return "", err
	}
	if !response.Resolved || response.AccountName == "" {
		return "", interfaces.ErrBankAccountNotFound
	}
	return response.AccountName, nil
}

func (provider *BachsConnectProvider) ListBanks(ctx context.Context, countryCode string) ([]interfaces.Bank, error) {
	if countryCode != "NG" {
		return nil, interfaces.ErrCurrencyNotSupported
	}
	var response struct {
		Banks []struct {
			Code string `json:"code"`
			Name string `json:"name"`
		} `json:"banks"`
	}
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/reference/banks", query: url.Values{"country": {countryCode}}}, &response); err != nil {
		return nil, err
	}
	banks := make([]interfaces.Bank, 0, len(response.Banks))
	for _, bank := range response.Banks {
		banks = append(banks, interfaces.Bank{Code: bank.Code, Name: bank.Name, CountryCode: countryCode})
	}
	return banks, nil
}

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"zudomart/modules/payments/src/integrations/providerHttp"
	"zudomart/modules/payments/src/interfaces"
)

func (provider *PaystackProvider) InitializeCharge(ctx context.Context, request interfaces.ChargeRequest) (interfaces.ChargeSession, error) {
	if request.CustomerEmail == "" || request.Reference == "" || request.AmountMinor <= 0 {
		return interfaces.ChargeSession{}, errors.New("paystack: a charge needs the account email, a reference and a positive amount")
	}
	channels := request.Channels
	if len(channels) == 0 {
		channels = provider.settings.Channels
	}
	metadata := map[string]any{}
	for key, value := range request.Metadata {
		metadata[key] = value
	}
	body := map[string]any{
		"email": request.CustomerEmail, "amount": request.AmountMinor, "currency": request.Currency, "reference": request.Reference,
		"callback_url": request.SuccessUrl, "channels": channels, "metadata": metadata,
	}
	if request.CustomerLabel != "" {
		body["label"] = request.CustomerLabel
	}
	if request.PlanCode != "" {
		body["plan"] = request.PlanCode
	}
	if err := applyDynamicSplit(body, request.SplitShares, request.AmountMinor); err != nil {
		return interfaces.ChargeSession{}, err
	}
	if request.SettlementAccount != "" && len(request.SplitShares) == 0 {
		if request.PlatformShareMinor < 0 || request.PlatformShareMinor >= request.AmountMinor {
			return interfaces.ChargeSession{}, errors.New("paystack: the platform share must be below the amount")
		}
		body["subaccount"], body["transaction_charge"] = request.SettlementAccount, request.PlatformShareMinor
		body["bearer"] = "account"
		if request.SubaccountBearsFee {
			body["bearer"] = "subaccount"
		}
	}
	var response struct {
		AuthorizationUrl string `json:"authorization_url"`
		AccessCode       string `json:"access_code"`
		Reference        string `json:"reference"`
	}
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/transaction/initialize", body: body, retrySafe: true}, &response); err != nil {
		return interfaces.ChargeSession{}, err
	}
	if response.AuthorizationUrl == "" {
		return interfaces.ChargeSession{}, fmt.Errorf("%w: paystack returned no authorization url", interfaces.ErrProviderUnavailable)
	}
	return interfaces.ChargeSession{CheckoutUrl: response.AuthorizationUrl, ProviderCheckoutId: response.AccessCode}, nil
}

type paystackTransaction struct {
	Id              json.Number     `json:"id"`
	Status          string          `json:"status"`
	Reference       string          `json:"reference"`
	Amount          json.Number     `json:"amount"`
	Fees            json.Number     `json:"fees"`
	Currency        string          `json:"currency"`
	Channel         string          `json:"channel"`
	GatewayResponse string          `json:"gateway_response"`
	Plan            json.RawMessage `json:"plan"`
	Customer        *struct {
		CustomerCode string `json:"customer_code"`
	} `json:"customer"`
	Authorization *struct {
		AuthorizationCode string `json:"authorization_code"`
		Last4             string `json:"last4"`
		ExpMonth          string `json:"exp_month"`
		ExpYear           string `json:"exp_year"`
		CardType          string `json:"card_type"`
		Brand             string `json:"brand"`
		Channel           string `json:"channel"`
		Reusable          bool   `json:"reusable"`
		Signature         string `json:"signature"`
	} `json:"authorization"`
	Subaccount json.RawMessage `json:"subaccount"`
}

func (transaction paystackTransaction) toVerification() interfaces.ChargeVerification {
	currency := strings.ToUpper(transaction.Currency)
	verification := interfaces.ChargeVerification{
		Reference: transaction.Reference, Outcome: interfaces.OutcomePending, AmountMinor: numberValue(transaction.Amount), Currency: currency,
		ProviderChargeId: transaction.Id.String(), ProviderFeeMinor: numberValue(transaction.Fees), Channel: transaction.Channel,
		PlanCode: planCodeFrom(transaction.Plan), SettlementAccount: subaccountCodeFrom(transaction.Subaccount),
	}
	if transaction.Customer != nil {
		verification.ProviderCustomerId = transaction.Customer.CustomerCode
	}
	if card := transaction.Authorization; card != nil && card.AuthorizationCode != "" {
		month, _ := strconv.Atoi(card.ExpMonth)
		year, _ := strconv.Atoi(card.ExpYear)
		brand := card.Brand
		if brand == "" {
			brand = strings.TrimSpace(card.CardType)
		}
		verification.Authorization = &interfaces.CardAuthorization{
			AuthorizationCode: card.AuthorizationCode, Signature: card.Signature, Brand: brand, Last4: card.Last4, ExpiryMonth: month, ExpiryYear: year,
			Reusable: card.Reusable, Channel: card.Channel,
		}
	}
	switch transaction.Status {
	case "success":
		verification.Outcome = interfaces.OutcomeSucceeded
	case "failed", "reversed":
		verification.Outcome, verification.FailureReason = interfaces.OutcomeFailed, truncate(transaction.Status+": "+transaction.GatewayResponse, 200)
	}
	return verification
}

func planCodeFrom(raw json.RawMessage) string {
	var code string
	if json.Unmarshal(raw, &code) == nil {
		return code
	}
	var object struct {
		PlanCode string `json:"plan_code"`
	}
	_ = json.Unmarshal(raw, &object)
	return object.PlanCode
}

func subaccountCodeFrom(raw json.RawMessage) string {
	var object struct {
		SubaccountCode string `json:"subaccount_code"`
	}
	_ = json.Unmarshal(raw, &object)
	return object.SubaccountCode
}

func (provider *PaystackProvider) VerifyCharge(ctx context.Context, lookup interfaces.ChargeLookup) (interfaces.ChargeVerification, error) {
	var transaction paystackTransaction
	err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/transaction/verify/" + url.PathEscape(lookup.Reference)}, &transaction)
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && requestError.StatusCode == http.StatusNotFound {
		return interfaces.ChargeVerification{Reference: lookup.Reference, Outcome: interfaces.OutcomePending}, nil
	}
	if err != nil {
		return interfaces.ChargeVerification{}, err
	}
	verification := transaction.toVerification()
	if verification.Reference == "" {
		verification.Reference = lookup.Reference
	}
	return verification, nil
}

func (provider *PaystackProvider) ChargeAuthorization(ctx context.Context, request interfaces.AuthorizationChargeRequest) (interfaces.AuthorizationChargeResult, error) {
	if !strings.HasPrefix(request.AuthorizationCode, "AUTH_") || request.CustomerEmail == "" || request.Reference == "" {
		return interfaces.AuthorizationChargeResult{}, interfaces.ErrSavedCardNotForCustomer
	}
	body := map[string]any{
		"email": request.CustomerEmail, "authorization_code": request.AuthorizationCode, "amount": request.AmountMinor, "currency": request.Currency,
		"reference": request.Reference, "metadata": request.Metadata,
	}
	if err := applyDynamicSplit(body, request.SplitShares, request.AmountMinor); err != nil {
		return interfaces.AuthorizationChargeResult{}, err
	}
	if request.SettlementAccount != "" && len(request.SplitShares) == 0 {
		body["subaccount"], body["transaction_charge"], body["bearer"] = request.SettlementAccount, 0, "subaccount"
		if !request.SubaccountBearsFee {
			body["bearer"] = "account"
		}
	}
	var response struct {
		paystackTransaction
		Paused           bool   `json:"paused"`
		AuthorizationUrl string `json:"authorization_url"`
	}
	err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/transaction/charge_authorization", body: body}, &response)
	if errors.Is(err, providerhttp.ErrOutcomeUnknown) {
		return interfaces.AuthorizationChargeResult{Outcome: interfaces.OutcomePending}, nil
	}
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && strings.Contains(strings.ToLower(requestError.Message), "duplicate transaction reference") {
		return interfaces.AuthorizationChargeResult{Outcome: interfaces.OutcomePending}, nil
	}
	if errors.As(err, &requestError) && requestError.IsDefinitiveRejection() {
		return interfaces.AuthorizationChargeResult{}, errors.Join(interfaces.ErrSavedCardNotForCustomer, err)
	}
	if err != nil {
		return interfaces.AuthorizationChargeResult{}, err
	}
	verification := response.toVerification()
	result := interfaces.AuthorizationChargeResult{ProviderChargeId: verification.ProviderChargeId, Outcome: verification.Outcome, FailureReason: verification.FailureReason}
	if response.Paused || (response.AuthorizationUrl != "" && verification.Outcome == interfaces.OutcomePending) {
		result.Paused, result.AuthorizationUrl, result.Outcome = true, response.AuthorizationUrl, interfaces.OutcomePending
	}
	return result, nil
}

func (provider *PaystackProvider) RefundCharge(ctx context.Context, request interfaces.RefundRequest) (interfaces.RefundResult, error) {
	transaction := request.ChargeReference
	if transaction == "" {
		transaction = request.ProviderChargeId
	}
	if transaction == "" {
		return interfaces.RefundResult{}, errors.New("paystack: a refund needs the transaction reference")
	}
	body := map[string]any{"transaction": transaction, "merchant_note": interfaces.RefundReferenceNote(truncate(request.Reason, 250), request.RefundReference)}
	if !request.FullRefund {
		body["amount"] = request.AmountMinor
	}
	var response struct {
		Id     json.Number `json:"id"`
		Status string      `json:"status"`
	}
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/refund", body: body}, &response); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: response.Id.String(), Outcome: convertPaystackRefundStatus(response.Status), NeedsCustomerDetail: response.Status == "needs-attention"}, nil
}

func convertPaystackRefundStatus(status string) interfaces.ProviderOutcome {
	switch status {
	case "processed":
		return interfaces.OutcomeSucceeded
	case "failed":
		return interfaces.OutcomeFailed
	}
	return interfaces.OutcomePending
}

func (provider *PaystackProvider) RetryRefundWithCustomerBankAccount(ctx context.Context, providerRefundId string, account interfaces.PayeeBankAccount) error {
	body := map[string]any{"refund_account_details": map[string]any{"currency": account.Currency, "account_number": account.AccountNumber, "bank_id": account.BankCode}}
	return provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/refund/retry_with_customer_details/" + url.PathEscape(providerRefundId), body: body}, nil)
}

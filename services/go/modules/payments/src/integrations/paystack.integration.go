package integrations

import (
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/utils"
)

var paystackCountryNames = map[string]string{"NG": "nigeria", "GH": "ghana", "KE": "kenya", "ZA": "south africa"}

var paystackTransferFeeTiersByCurrency = map[string][]utils.TransferFeeTier{
	"NGN": {{UpToAmountMinor: 500_000, FeeMinor: 1_000}, {UpToAmountMinor: 5_000_000, FeeMinor: 2_500}, {FeeMinor: 5_000}},
}

type PaystackProvider struct {
	http         providerHttpClient
	feeOverrides map[string]int64
}

func NewPaystackProvider(baseUrl, secretKey string, feeOverrides map[string]int64) *PaystackProvider {
	if baseUrl == "" {
		baseUrl = "https://api.paystack.co"
	}
	return &PaystackProvider{http: newProviderHttpClient("paystack", strings.TrimRight(baseUrl, "/"), secretKey), feeOverrides: feeOverrides}
}

func (provider *PaystackProvider) Name() string { return "paystack" }

func (provider *PaystackProvider) SupportsCurrency(currency string) bool {
	switch currency {
	case "NGN", "GHS", "ZAR", "KES", "USD":
		return true
	}
	return false
}

type paystackEnvelope[Data any] struct {
	Status  bool   `json:"status"`
	Message string `json:"message"`
	Data    Data   `json:"data"`
}

func (provider *PaystackProvider) InitializeCharge(ctx context.Context, request interfaces.ChargeRequest) (interfaces.ChargeSession, error) {
	var response paystackEnvelope[struct {
		AuthorizationUrl string `json:"authorization_url"`
	}]
	body := map[string]any{"email": request.Email, "amount": request.AmountMinor, "currency": request.Currency, "reference": request.Reference, "callback_url": request.CallbackUrl, "metadata": request.Metadata}
	if err := provider.http.sendJson(ctx, http.MethodPost, "/transaction/initialize", body, &response); err != nil {
		return interfaces.ChargeSession{}, err
	}
	if response.Data.AuthorizationUrl == "" {
		return interfaces.ChargeSession{}, fmt.Errorf("%w: paystack returned no authorization url", interfaces.ErrProviderUnavailable)
	}
	return interfaces.ChargeSession{AuthorizationUrl: response.Data.AuthorizationUrl}, nil
}

type paystackTransaction struct {
	Id              json.Number `json:"id"`
	Status          string      `json:"status"`
	Reference       string      `json:"reference"`
	Amount          json.Number `json:"amount"`
	Fees            json.Number `json:"fees"`
	Currency        string      `json:"currency"`
	GatewayResponse string      `json:"gateway_response"`
}

func (provider *PaystackProvider) VerifyCharge(ctx context.Context, reference string) (interfaces.ChargeVerification, error) {
	var response paystackEnvelope[paystackTransaction]
	if err := provider.http.sendJson(ctx, http.MethodGet, "/transaction/verify/"+url.PathEscape(reference), nil, &response); err != nil {
		return interfaces.ChargeVerification{}, err
	}
	data := response.Data
	amount, _ := data.Amount.Int64()
	fee, _ := data.Fees.Int64()
	verification := interfaces.ChargeVerification{Reference: data.Reference, AmountMinor: amount, Currency: strings.ToUpper(data.Currency), ProviderTransactionId: data.Id.String(), ProviderFeeMinor: fee}
	switch data.Status {
	case "success":
		verification.Outcome = interfaces.OutcomeSucceeded
	case "failed", "abandoned", "reversed":
		verification.Outcome = interfaces.OutcomeFailed
		verification.FailureReason = truncate(data.GatewayResponse, 200)
	default:
		verification.Outcome = interfaces.OutcomePending
	}
	return verification, nil
}

func (provider *PaystackProvider) RefundCharge(ctx context.Context, request interfaces.RefundRequest) (interfaces.RefundResult, error) {
	var response paystackEnvelope[struct {
		Id     json.Number `json:"id"`
		Status string      `json:"status"`
	}]
	if err := provider.http.sendJson(ctx, http.MethodPost, "/refund", map[string]any{"transaction": request.PaymentReference, "amount": request.AmountMinor}, &response); err != nil {
		return interfaces.RefundResult{}, err
	}
	result := interfaces.RefundResult{ProviderRefundId: response.Data.Id.String(), Outcome: interfaces.OutcomePending}
	switch response.Data.Status {
	case "processed":
		result.Outcome = interfaces.OutcomeSucceeded
	case "failed":
		result.Outcome = interfaces.OutcomeFailed
		result.FailureReason = "refund failed at paystack"
	}
	return result, nil
}

func (provider *PaystackProvider) InitiateTransfer(ctx context.Context, request interfaces.TransferRequest) (interfaces.TransferResult, error) {
	var recipient paystackEnvelope[struct {
		RecipientCode string `json:"recipient_code"`
	}]
	recipientBody := map[string]any{"type": "nuban", "name": request.AccountName, "account_number": request.AccountNumber, "bank_code": request.BankCode, "currency": request.Currency}
	if err := provider.http.sendJson(ctx, http.MethodPost, "/transferrecipient", recipientBody, &recipient); err != nil {
		return interfaces.TransferResult{}, err
	}
	var transfer paystackEnvelope[paystackTransfer]
	transferBody := map[string]any{"source": "balance", "amount": request.AmountMinor, "recipient": recipient.Data.RecipientCode, "reference": request.Reference, "reason": request.Narration, "currency": request.Currency}
	if err := provider.http.sendJson(ctx, http.MethodPost, "/transfer", transferBody, &transfer); err != nil {
		return interfaces.TransferResult{}, err
	}
	return convertPaystackTransfer(transfer.Data), nil
}

type paystackTransfer struct {
	TransferCode string `json:"transfer_code"`
	Status       string `json:"status"`
	Reason       string `json:"reason"`
}

func convertPaystackTransfer(transfer paystackTransfer) interfaces.TransferResult {
	result := interfaces.TransferResult{ProviderTransferCode: transfer.TransferCode, Outcome: interfaces.OutcomePending}
	switch transfer.Status {
	case "success":
		result.Outcome = interfaces.OutcomeSucceeded
	case "failed", "reversed":
		result.Outcome = interfaces.OutcomeFailed
		result.FailureReason = "transfer " + transfer.Status + " at paystack"
	}
	return result
}

func (provider *PaystackProvider) VerifyTransfer(ctx context.Context, lookup interfaces.TransferLookup) (interfaces.TransferResult, error) {
	var response paystackEnvelope[paystackTransfer]
	if err := provider.http.sendJson(ctx, http.MethodGet, "/transfer/verify/"+url.PathEscape(lookup.Reference), nil, &response); err != nil {
		return interfaces.TransferResult{}, err
	}
	return convertPaystackTransfer(response.Data), nil
}

func (provider *PaystackProvider) QuoteTransferFee(currency string, amountMinor int64) (int64, error) {
	if fee, overridden := provider.feeOverrides["paystack:"+currency]; overridden {
		return fee, nil
	}
	tiers, known := paystackTransferFeeTiersByCurrency[currency]
	if !known {
		return 0, interfaces.ErrCurrencyNotSupported
	}
	return utils.FeeForAmountFromTiers(tiers, amountMinor), nil
}

func (provider *PaystackProvider) ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	var response paystackEnvelope[struct {
		AccountName string `json:"account_name"`
	}]
	query := url.Values{"account_number": {accountNumber}, "bank_code": {bankCode}}
	err := provider.http.sendJson(ctx, http.MethodGet, "/bank/resolve?"+query.Encode(), nil, &response)
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && (requestError.StatusCode == http.StatusUnprocessableEntity || requestError.StatusCode == http.StatusBadRequest || requestError.StatusCode == http.StatusNotFound) {
		return "", interfaces.ErrBankAccountNotFound
	}
	if err != nil {
		return "", err
	}
	if response.Data.AccountName == "" {
		return "", interfaces.ErrBankAccountNotFound
	}
	return response.Data.AccountName, nil
}

func (provider *PaystackProvider) ListBanks(ctx context.Context, countryCode string) ([]interfaces.Bank, error) {
	country, supported := paystackCountryNames[countryCode]
	if !supported {
		return nil, interfaces.ErrCurrencyNotSupported
	}
	var response paystackEnvelope[[]struct {
		Code   string `json:"code"`
		Name   string `json:"name"`
		Active bool   `json:"active"`
	}]
	if err := provider.http.sendJson(ctx, http.MethodGet, "/bank?"+url.Values{"country": {country}, "perPage": {"200"}}.Encode(), nil, &response); err != nil {
		return nil, err
	}
	banks := make([]interfaces.Bank, 0, len(response.Data))
	for _, bank := range response.Data {
		if bank.Active {
			banks = append(banks, interfaces.Bank{Code: bank.Code, Name: bank.Name, CountryCode: countryCode})
		}
	}
	return banks, nil
}

func (provider *PaystackProvider) VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (interfaces.WebhookNotification, error) {
	if provider.http.secretKey == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrProviderNotConfigured
	}
	mac := hmac.New(sha512.New, []byte(provider.http.secretKey))
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(strings.ToLower(strings.TrimSpace(headers.Get("X-Paystack-Signature"))))) {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	var payload struct {
		Event string `json:"event"`
		Data  struct {
			Id           json.Number `json:"id"`
			Reference    string      `json:"reference"`
			TransferCode string      `json:"transfer_code"`
		} `json:"data"`
	}
	decoder := json.NewDecoder(strings.NewReader(string(rawBody)))
	decoder.UseNumber()
	if err := decoder.Decode(&payload); err != nil || payload.Event == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	identity := payload.Data.Id.String()
	if identity == "" {
		identity = payload.Data.Reference
	}
	return interfaces.WebhookNotification{
		EventKey: payload.Event + ":" + identity, EventType: payload.Event, Kind: classifyWebhookEvent(payload.Event),
		Reference: payload.Data.Reference, ProviderTransferCode: payload.Data.TransferCode,
	}, nil
}

func classifyWebhookEvent(eventType string) interfaces.WebhookKind {
	switch {
	case strings.HasPrefix(eventType, "charge."):
		return interfaces.WebhookKindCharge
	case strings.HasPrefix(eventType, "transfer."):
		return interfaces.WebhookKindTransfer
	case strings.HasPrefix(eventType, "refund."):
		return interfaces.WebhookKindRefund
	}
	return interfaces.WebhookKindOther
}

func (provider *PaystackProvider) ListSettledCharges(ctx context.Context, from, to time.Time) ([]interfaces.SettledCharge, error) {
	var settled []interfaces.SettledCharge
	for page := 1; page <= 50; page++ {
		var response paystackEnvelope[[]paystackTransaction]
		query := url.Values{"from": {from.UTC().Format(time.RFC3339)}, "to": {to.UTC().Format(time.RFC3339)}, "status": {"success"}, "perPage": {"100"}, "page": {fmt.Sprint(page)}}
		if err := provider.http.sendJson(ctx, http.MethodGet, "/transaction?"+query.Encode(), nil, &response); err != nil {
			return nil, err
		}
		for _, transaction := range response.Data {
			amount, _ := transaction.Amount.Int64()
			settled = append(settled, interfaces.SettledCharge{Reference: transaction.Reference, AmountMinor: amount, Currency: strings.ToUpper(transaction.Currency)})
		}
		if len(response.Data) < 100 {
			break
		}
	}
	return settled, nil
}

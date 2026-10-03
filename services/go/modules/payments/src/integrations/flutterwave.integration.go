package integrations

import (
	"context"
	"crypto/subtle"
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

var flutterwaveTransferFeeTiersByCurrency = map[string][]utils.TransferFeeTier{
	"NGN": {{UpToAmountMinor: 500_000, FeeMinor: 1_075}, {UpToAmountMinor: 5_000_000, FeeMinor: 2_688}, {FeeMinor: 5_375}},
}

type FlutterwaveProvider struct {
	http         providerHttpClient
	webhookHash  string
	feeOverrides map[string]int64
}

func NewFlutterwaveProvider(baseUrl, secretKey, webhookHash string, feeOverrides map[string]int64) *FlutterwaveProvider {
	if baseUrl == "" {
		baseUrl = "https://api.flutterwave.com/v3"
	}
	return &FlutterwaveProvider{http: newProviderHttpClient("flutterwave", strings.TrimRight(baseUrl, "/"), secretKey), webhookHash: webhookHash, feeOverrides: feeOverrides}
}

func (provider *FlutterwaveProvider) Name() string { return "flutterwave" }

func (provider *FlutterwaveProvider) SupportsCurrency(currency string) bool {
	switch currency {
	case "NGN", "GHS", "KES", "ZAR", "USD", "GBP", "EUR":
		return true
	}
	return false
}

type flutterwaveEnvelope[Data any] struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    Data   `json:"data"`
}

func (provider *FlutterwaveProvider) InitializeCharge(ctx context.Context, request interfaces.ChargeRequest) (interfaces.ChargeSession, error) {
	amount, err := utils.FormatMinorUnitsAsMajorDecimal(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.ChargeSession{}, err
	}
	var response flutterwaveEnvelope[struct {
		Link string `json:"link"`
	}]
	body := map[string]any{"tx_ref": request.Reference, "amount": amount, "currency": request.Currency, "redirect_url": request.CallbackUrl, "customer": map[string]string{"email": request.Email}, "meta": request.Metadata}
	if err := provider.http.sendJson(ctx, http.MethodPost, "/payments", body, &response); err != nil {
		return interfaces.ChargeSession{}, err
	}
	if response.Data.Link == "" {
		return interfaces.ChargeSession{}, fmt.Errorf("%w: flutterwave returned no payment link", interfaces.ErrProviderUnavailable)
	}
	return interfaces.ChargeSession{AuthorizationUrl: response.Data.Link}, nil
}

type flutterwaveTransaction struct {
	Id              json.Number `json:"id"`
	TxRef           string      `json:"tx_ref"`
	Status          string      `json:"status"`
	Amount          json.Number `json:"amount"`
	AppFee          json.Number `json:"app_fee"`
	Currency        string      `json:"currency"`
	ProcessorReason string      `json:"processor_response"`
}

func (provider *FlutterwaveProvider) VerifyCharge(ctx context.Context, reference string) (interfaces.ChargeVerification, error) {
	var response flutterwaveEnvelope[flutterwaveTransaction]
	if err := provider.http.sendJson(ctx, http.MethodGet, "/transactions/verify_by_reference?"+url.Values{"tx_ref": {reference}}.Encode(), nil, &response); err != nil {
		return interfaces.ChargeVerification{}, err
	}
	data := response.Data
	currency := strings.ToUpper(data.Currency)
	amount, err := utils.ParseMajorDecimalToMinorUnits(data.Amount.String(), currency)
	if err != nil {
		amount = -1
	}
	fee, _ := utils.ParseMajorDecimalToMinorUnits(data.AppFee.String(), currency)
	verification := interfaces.ChargeVerification{Reference: data.TxRef, AmountMinor: amount, Currency: currency, ProviderTransactionId: data.Id.String(), ProviderFeeMinor: fee}
	switch data.Status {
	case "successful":
		verification.Outcome = interfaces.OutcomeSucceeded
	case "failed", "cancelled":
		verification.Outcome = interfaces.OutcomeFailed
		verification.FailureReason = truncate(data.ProcessorReason, 200)
	default:
		verification.Outcome = interfaces.OutcomePending
	}
	return verification, nil
}

func (provider *FlutterwaveProvider) RefundCharge(ctx context.Context, request interfaces.RefundRequest) (interfaces.RefundResult, error) {
	if request.ProviderTransactionId == "" {
		return interfaces.RefundResult{}, fmt.Errorf("%w: flutterwave refunds need the provider transaction id", interfaces.ErrProviderUnavailable)
	}
	amount, err := utils.FormatMinorUnitsAsMajorDecimal(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.RefundResult{}, err
	}
	var response flutterwaveEnvelope[struct {
		Id     json.Number `json:"id"`
		Status string      `json:"status"`
	}]
	if err := provider.http.sendJson(ctx, http.MethodPost, "/transactions/"+url.PathEscape(request.ProviderTransactionId)+"/refund", map[string]any{"amount": amount}, &response); err != nil {
		return interfaces.RefundResult{}, err
	}
	result := interfaces.RefundResult{ProviderRefundId: response.Data.Id.String(), Outcome: interfaces.OutcomePending}
	switch strings.ToLower(response.Data.Status) {
	case "completed", "successful":
		result.Outcome = interfaces.OutcomeSucceeded
	case "failed":
		result.Outcome = interfaces.OutcomeFailed
		result.FailureReason = "refund failed at flutterwave"
	}
	return result, nil
}

type flutterwaveTransfer struct {
	Id              json.Number `json:"id"`
	Status          string      `json:"status"`
	CompleteMessage string      `json:"complete_message"`
}

func convertFlutterwaveTransfer(transfer flutterwaveTransfer) interfaces.TransferResult {
	result := interfaces.TransferResult{ProviderTransferCode: transfer.Id.String(), Outcome: interfaces.OutcomePending}
	switch strings.ToUpper(transfer.Status) {
	case "SUCCESSFUL":
		result.Outcome = interfaces.OutcomeSucceeded
	case "FAILED":
		result.Outcome = interfaces.OutcomeFailed
		result.FailureReason = truncate(transfer.CompleteMessage, 200)
	}
	return result
}

func (provider *FlutterwaveProvider) InitiateTransfer(ctx context.Context, request interfaces.TransferRequest) (interfaces.TransferResult, error) {
	amount, err := utils.FormatMinorUnitsAsMajorDecimal(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.TransferResult{}, err
	}
	var response flutterwaveEnvelope[flutterwaveTransfer]
	body := map[string]any{"account_bank": request.BankCode, "account_number": request.AccountNumber, "amount": amount, "currency": request.Currency, "reference": request.Reference, "narration": request.Narration, "debit_currency": request.Currency}
	if err := provider.http.sendJson(ctx, http.MethodPost, "/transfers", body, &response); err != nil {
		return interfaces.TransferResult{}, err
	}
	return convertFlutterwaveTransfer(response.Data), nil
}

func (provider *FlutterwaveProvider) VerifyTransfer(ctx context.Context, lookup interfaces.TransferLookup) (interfaces.TransferResult, error) {
	if lookup.ProviderTransferCode == "" {
		return interfaces.TransferResult{Outcome: interfaces.OutcomePending}, nil
	}
	var response flutterwaveEnvelope[flutterwaveTransfer]
	if err := provider.http.sendJson(ctx, http.MethodGet, "/transfers/"+url.PathEscape(lookup.ProviderTransferCode), nil, &response); err != nil {
		return interfaces.TransferResult{}, err
	}
	return convertFlutterwaveTransfer(response.Data), nil
}

func (provider *FlutterwaveProvider) QuoteTransferFee(currency string, amountMinor int64) (int64, error) {
	if fee, overridden := provider.feeOverrides["flutterwave:"+currency]; overridden {
		return fee, nil
	}
	tiers, known := flutterwaveTransferFeeTiersByCurrency[currency]
	if !known {
		return 0, interfaces.ErrCurrencyNotSupported
	}
	return utils.FeeForAmountFromTiers(tiers, amountMinor), nil
}

func (provider *FlutterwaveProvider) ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	var response flutterwaveEnvelope[struct {
		AccountName string `json:"account_name"`
	}]
	err := provider.http.sendJson(ctx, http.MethodPost, "/accounts/resolve", map[string]string{"account_number": accountNumber, "account_bank": bankCode}, &response)
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && requestError.StatusCode >= 400 && requestError.StatusCode < 500 {
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

func (provider *FlutterwaveProvider) ListBanks(ctx context.Context, countryCode string) ([]interfaces.Bank, error) {
	var response flutterwaveEnvelope[[]struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}]
	if err := provider.http.sendJson(ctx, http.MethodGet, "/banks/"+url.PathEscape(countryCode), nil, &response); err != nil {
		return nil, err
	}
	banks := make([]interfaces.Bank, 0, len(response.Data))
	for _, bank := range response.Data {
		banks = append(banks, interfaces.Bank{Code: bank.Code, Name: bank.Name, CountryCode: countryCode})
	}
	return banks, nil
}

func (provider *FlutterwaveProvider) VerifyWebhookSignatureAndParse(rawBody []byte, headers http.Header) (interfaces.WebhookNotification, error) {
	received := strings.TrimSpace(headers.Get("Verif-Hash"))
	if provider.webhookHash == "" || received == "" || subtle.ConstantTimeCompare([]byte(provider.webhookHash), []byte(received)) != 1 {
		return interfaces.WebhookNotification{}, interfaces.ErrInvalidWebhookSignature
	}
	var payload struct {
		Event string `json:"event"`
		Data  struct {
			Id        json.Number `json:"id"`
			TxRef     string      `json:"tx_ref"`
			Reference string      `json:"reference"`
		} `json:"data"`
	}
	decoder := json.NewDecoder(strings.NewReader(string(rawBody)))
	decoder.UseNumber()
	if err := decoder.Decode(&payload); err != nil || payload.Event == "" {
		return interfaces.WebhookNotification{}, interfaces.ErrMalformedWebhookPayload
	}
	reference := payload.Data.TxRef
	if reference == "" {
		reference = payload.Data.Reference
	}
	identity := payload.Data.Id.String()
	if identity == "" {
		identity = reference
	}
	return interfaces.WebhookNotification{
		EventKey: payload.Event + ":" + identity, EventType: payload.Event, Kind: classifyWebhookEvent(payload.Event),
		Reference: reference, ProviderTransferCode: payload.Data.Id.String(), ProviderRefundId: payload.Data.Id.String(),
	}, nil
}

func (provider *FlutterwaveProvider) ListSettledCharges(ctx context.Context, from, to time.Time) ([]interfaces.SettledCharge, error) {
	var settled []interfaces.SettledCharge
	for page := 1; page <= 50; page++ {
		var response flutterwaveEnvelope[[]flutterwaveTransaction]
		query := url.Values{"from": {from.UTC().Format("2006-01-02")}, "to": {to.UTC().Format("2006-01-02")}, "status": {"successful"}, "page": {fmt.Sprint(page)}}
		if err := provider.http.sendJson(ctx, http.MethodGet, "/transactions?"+query.Encode(), nil, &response); err != nil {
			return nil, err
		}
		if len(response.Data) == 0 {
			break
		}
		for _, transaction := range response.Data {
			currency := strings.ToUpper(transaction.Currency)
			amount, err := utils.ParseMajorDecimalToMinorUnits(transaction.Amount.String(), currency)
			if err != nil {
				return nil, fmt.Errorf("flutterwave settlement %s: %w", transaction.TxRef, err)
			}
			settled = append(settled, interfaces.SettledCharge{Reference: transaction.TxRef, AmountMinor: amount, Currency: currency})
		}
	}
	return settled, nil
}

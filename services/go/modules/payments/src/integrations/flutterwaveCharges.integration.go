package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
)

var flutterwaveChargeIdPattern = regexp.MustCompile(`^[0-9]{1,20}$`)

func FlutterwavePayloadHash(amount, currency, email, reference, secretKey string) string {
	secretDigest := sha256.Sum256([]byte(secretKey))
	digest := sha256.Sum256([]byte(amount + currency + email + reference + hex.EncodeToString(secretDigest[:])))
	return hex.EncodeToString(digest[:])
}

func (provider *FlutterwaveProvider) InitializeCharge(ctx context.Context, request interfaces.ChargeRequest) (interfaces.ChargeSession, error) {
	if request.CustomerEmail == "" || request.Reference == "" || request.AmountMinor <= 0 {
		return interfaces.ChargeSession{}, errors.New("flutterwave: a charge needs the account email, a reference and a positive amount")
	}
	if !provider.SupportsCurrency(request.Currency) {
		return interfaces.ChargeSession{}, interfaces.ErrCurrencyNotSupported
	}
	amount := majorUnits(request.AmountMinor, request.Currency)
	options := strings.Join(request.Channels, ",")
	if configured := provider.settings.PaymentOptions[request.Currency]; configured != "" {
		options = configured
	}
	meta := map[string]any{}
	for key, value := range request.Metadata {
		meta[key] = value
	}
	sessionMinutes := request.ExpiresInMinutes
	if sessionMinutes <= 0 || sessionMinutes > 1440 {
		sessionMinutes = 30
	}
	body := map[string]any{
		"tx_ref": request.Reference, "amount": amount, "currency": request.Currency, "redirect_url": request.SuccessUrl,
		"customer":        map[string]any{"email": request.CustomerEmail, "name": request.CustomerLabel},
		"configuration":   map[string]any{"session_duration": sessionMinutes, "max_retry_attempt": 3},
		"payment_options": options, "meta": meta,
		"customizations": map[string]any{"title": provider.settings.CheckoutTitle, "logo": provider.settings.CheckoutLogoUrl},
		"payload_hash":   FlutterwavePayloadHash(amount.String(), request.Currency, request.CustomerEmail, request.Reference, provider.settings.SecretKey),
	}
	var response struct {
		Link string `json:"link"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/payments", body: body}, &response); err != nil {
		return interfaces.ChargeSession{}, err
	}
	if !strings.HasPrefix(response.Link, "https://") && !strings.HasPrefix(response.Link, "http://127.0.0.1") {
		return interfaces.ChargeSession{}, fmt.Errorf("%w: flutterwave returned no checkout link", interfaces.ErrProviderUnavailable)
	}
	return interfaces.ChargeSession{CheckoutUrl: response.Link, ProviderCheckoutId: request.Reference}, nil
}

type flutterwaveTransaction struct {
	Id          json.Number     `json:"id"`
	TxRef       string          `json:"tx_ref"`
	FlwRef      string          `json:"flw_ref"`
	Amount      json.RawMessage `json:"amount"`
	AppFee      json.RawMessage `json:"app_fee"`
	Currency    string          `json:"currency"`
	Status      string          `json:"status"`
	PaymentType string          `json:"payment_type"`
	Processor   string          `json:"processor_response"`
	Customer    *struct {
		Id    json.Number `json:"id"`
		Email string      `json:"email"`
	} `json:"customer"`
	Card *struct {
		First6  string `json:"first_6digits"`
		Last4   string `json:"last_4digits"`
		Issuer  string `json:"issuer"`
		Country string `json:"country"`
		Type    string `json:"type"`
		Token   string `json:"token"`
		Expiry  string `json:"expiry"`
	} `json:"card"`
}

func (transaction flutterwaveTransaction) toVerification() (interfaces.ChargeVerification, error) {
	currency := strings.ToUpper(transaction.Currency)
	amount, err := flutterwaveAmountMinor(transaction.Amount, currency)
	if err != nil {
		return interfaces.ChargeVerification{}, err
	}
	verification := interfaces.ChargeVerification{
		Reference: transaction.TxRef, Outcome: interfaces.OutcomePending, AmountMinor: amount, Currency: currency, ProviderChargeId: transaction.Id.String(),
		ProviderFeeMinor: flutterwaveFeeMinor(transaction.AppFee, currency), Channel: transaction.PaymentType,
	}
	if transaction.Customer != nil {
		verification.CustomerEmail, verification.ProviderCustomerId = strings.ToLower(strings.TrimSpace(transaction.Customer.Email)), transaction.Customer.Id.String()
	}
	if card := transaction.Card; card != nil && card.Token != "" {
		month, year := parseCardExpiry(card.Expiry)
		verification.Authorization = &interfaces.CardAuthorization{
			AuthorizationCode: card.Token, Signature: card.First6 + ":" + card.Last4 + ":" + card.Expiry + ":" + card.Issuer, Brand: strings.TrimSpace(card.Type),
			Last4: card.Last4, ExpiryMonth: month, ExpiryYear: year, Reusable: true, Channel: "card",
		}
	}
	switch strings.ToLower(transaction.Status) {
	case "successful":
		verification.Outcome = interfaces.OutcomeSucceeded
	case "failed", "cancelled", "error":
		verification.Outcome, verification.FailureReason = interfaces.OutcomeFailed, truncate(transaction.Status+": "+transaction.Processor, 200)
	}
	return verification, nil
}

func parseCardExpiry(expiry string) (int, int) {
	monthText, yearText, _ := strings.Cut(expiry, "/")
	month, _ := strconv.Atoi(monthText)
	year, _ := strconv.Atoi(yearText)
	if year > 0 && year < 100 {
		year += 2000
	}
	return month, year
}

func (provider *FlutterwaveProvider) VerifyCharge(ctx context.Context, lookup interfaces.ChargeLookup) (interfaces.ChargeVerification, error) {
	if flutterwaveChargeIdPattern.MatchString(lookup.ProviderChargeId) {
		verification, err := provider.verifyChargeById(ctx, lookup.ProviderChargeId)
		if err == nil && verification.Reference == lookup.Reference {
			return verification, nil
		}
		if err != nil && !isDefinitiveFlutterwaveRejection(err) {
			return interfaces.ChargeVerification{}, err
		}
	}
	var transaction flutterwaveTransaction
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/transactions/verify_by_reference", query: url.Values{"tx_ref": {lookup.Reference}}}, &transaction)
	if isFlutterwaveNotFound(err) || (err == nil && transaction.TxRef != lookup.Reference) {
		return interfaces.ChargeVerification{Reference: lookup.Reference, Outcome: interfaces.OutcomePending}, nil
	}
	if err != nil {
		return interfaces.ChargeVerification{}, err
	}
	return transaction.toVerification()
}

func (provider *FlutterwaveProvider) verifyChargeById(ctx context.Context, chargeId string) (interfaces.ChargeVerification, error) {
	var transaction flutterwaveTransaction
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/transactions/" + url.PathEscape(chargeId) + "/verify"}, &transaction); err != nil {
		return interfaces.ChargeVerification{}, err
	}
	return transaction.toVerification()
}

func (provider *FlutterwaveProvider) ChargeAuthorization(ctx context.Context, request interfaces.AuthorizationChargeRequest) (interfaces.AuthorizationChargeResult, error) {
	if !strings.HasPrefix(request.AuthorizationCode, "flw-t") || request.CustomerEmail == "" || request.Reference == "" || request.AmountMinor <= 0 {
		return interfaces.AuthorizationChargeResult{}, interfaces.ErrSavedCardNotForCustomer
	}
	body := map[string]any{
		"token": request.AuthorizationCode, "email": request.CustomerEmail, "currency": request.Currency, "country": provider.settings.MerchantCountry,
		"amount": majorUnits(request.AmountMinor, request.Currency), "tx_ref": request.Reference, "redirect_url": provider.settings.RenewalRedirectUrl,
		"narration": "Zudomart", "meta": request.Metadata,
	}
	var transaction flutterwaveTransaction
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/tokenized-charges", body: body}, &transaction)
	if errors.Is(err, providerhttp.ErrOutcomeUnknown) {
		return interfaces.AuthorizationChargeResult{Outcome: interfaces.OutcomePending}, nil
	}
	if err != nil && isDefinitiveFlutterwaveRejection(err) {
		existing, verifyErr := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: request.Reference})
		if verifyErr == nil && existing.ProviderChargeId != "" {
			return interfaces.AuthorizationChargeResult{ProviderChargeId: existing.ProviderChargeId, Outcome: existing.Outcome, FailureReason: existing.FailureReason}, nil
		}
		return interfaces.AuthorizationChargeResult{}, errors.Join(interfaces.ErrSavedCardNotForCustomer, err)
	}
	if err != nil {
		return interfaces.AuthorizationChargeResult{}, err
	}
	verification, err := transaction.toVerification()
	if err != nil {
		return interfaces.AuthorizationChargeResult{Outcome: interfaces.OutcomePending}, nil
	}
	if verification.Outcome == interfaces.OutcomeSucceeded {
		verification.Outcome = interfaces.OutcomePending
	}
	return interfaces.AuthorizationChargeResult{ProviderChargeId: verification.ProviderChargeId, Outcome: verification.Outcome, FailureReason: verification.FailureReason}, nil
}

type flutterwaveRefund struct {
	Id             json.Number     `json:"id"`
	FlwRef         string          `json:"flw_ref"`
	AmountRefunded json.RawMessage `json:"amount_refunded"`
	Status         string          `json:"status"`
	Comments       string          `json:"comments"`
	TransactionId  json.Number     `json:"transaction_id"`
}

func convertFlutterwaveRefundStatus(status string) interfaces.ProviderOutcome {
	switch strings.ToLower(status) {
	case "completed", "completed-mpgs", "successful", "succeeded":
		return interfaces.OutcomeSucceeded
	case "failed", "cancelled", "declined":
		return interfaces.OutcomeFailed
	}
	return interfaces.OutcomePending
}

func (provider *FlutterwaveProvider) RefundCharge(ctx context.Context, request interfaces.RefundRequest) (interfaces.RefundResult, error) {
	if request.ProviderChargeId == "" && request.ChargeReference != "" {
		verification, err := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: request.ChargeReference})
		if err != nil {
			return interfaces.RefundResult{}, err
		}
		if verification.Outcome == interfaces.OutcomeSucceeded {
			request.ProviderChargeId = verification.ProviderChargeId
		}
	}
	if !flutterwaveChargeIdPattern.MatchString(request.ProviderChargeId) {
		return interfaces.RefundResult{}, errors.New("flutterwave: a refund needs the verified transaction id")
	}
	body := map[string]any{"comments": interfaces.RefundReferenceNote(truncate(request.Reason, 200), request.RefundReference)}
	if !request.FullRefund {
		body["amount"] = majorUnits(request.AmountMinor, request.Currency)
	}
	var refund flutterwaveRefund
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/transactions/" + url.PathEscape(request.ProviderChargeId) + "/refund", body: body}, &refund); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertFlutterwaveRefundStatus(refund.Status)}, nil
}

func (provider *FlutterwaveProvider) FindRefundByReference(ctx context.Context, lookup interfaces.RefundLookup) (interfaces.RefundResult, bool, error) {
	query := url.Values{}
	if !lookup.SubmittedAfter.IsZero() {
		query.Set("from", lookup.SubmittedAfter.AddDate(0, 0, -1).UTC().Format("2006-01-02"))
		query.Set("to", provider.Now().AddDate(0, 0, 1).UTC().Format("2006-01-02"))
	}
	var refunds []flutterwaveRefund
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/refunds", query: query}, &refunds); err != nil {
		return interfaces.RefundResult{}, false, err
	}
	for _, refund := range refunds {
		if interfaces.NoteCarriesRefundReference(refund.Comments, lookup.RefundReference) {
			return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertFlutterwaveRefundStatus(refund.Status)}, true, nil
		}
	}
	return interfaces.RefundResult{}, false, nil
}

func (provider *FlutterwaveProvider) ReadRefund(ctx context.Context, providerRefundId string) (interfaces.RefundResult, error) {
	var refund flutterwaveRefund
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/refunds/" + url.PathEscape(providerRefundId)}, &refund); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertFlutterwaveRefundStatus(refund.Status)}, nil
}

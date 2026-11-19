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

	"nantty/modules/payments/src/interfaces"
	"nantty/platform/money"
)

type flutterwaveRefund struct {
	Id             json.Number     `json:"id"`
	FlwRef         string          `json:"flw_ref"`
	AmountRefunded json.RawMessage `json:"amount_refunded"`
	Status         string          `json:"status"`
	Comment        string          `json:"comment"`
	Comments       string          `json:"comments"`
	TransactionId  json.Number     `json:"transaction_id"`
}

func convertFlutterwaveRefundStatus(status string) interfaces.ProviderOutcome {
	switch strings.ToLower(status) {
	case "completed-bank-transfer", "completed-momo", "completed-mpgs", "completed-offline", "completed-preauth", "successful", "succeeded":
		return interfaces.OutcomeSucceeded
	case "failed", "cancelled", "declined":
		return interfaces.OutcomeFailed
	}
	return interfaces.OutcomePending
}

func flutterwaveRefundAmount(amountMinor int64, currency string) (json.Number, error) {
	currencyCode, err := money.ParseCurrencyCode(currency)
	if err != nil {
		return "", interfaces.ErrCurrencyNotSupported
	}
	minorScale := int64(1)
	for range money.MinorUnitExponentForCurrency(currencyCode) {
		minorScale *= 10
	}
	if amountMinor%minorScale != 0 {
		return "", errors.New("flutterwave: partial refund must be representable as an integer provider amount")
	}
	majorAmount := amountMinor / minorScale
	if majorAmount > (1<<31)-1 {
		return "", errors.New("flutterwave: partial refund exceeds the provider amount limit")
	}
	switch currencyCode {
	case "NGN":
		if majorAmount < 100 {
			return "", errors.New("flutterwave: NGN refunds must be at least 100")
		}
	case "KES":
		if majorAmount < 10 {
			return "", errors.New("flutterwave: KES refunds must be at least 10")
		}
	}
	return json.Number(strconv.FormatInt(majorAmount, 10)), nil
}

func flutterwaveRefundMinimumMinor(currency string) int64 {
	switch currency {
	case "NGN":
		return 100 * 100
	case "KES":
		return 10 * 100
	default:
		return 0
	}
}

func (provider *FlutterwaveProvider) RefundCharge(ctx context.Context, request interfaces.RefundRequest) (interfaces.RefundResult, error) {
	if request.AmountMinor < 0 || (!request.FullRefund && request.AmountMinor <= 0) {
		return interfaces.RefundResult{}, errors.New("flutterwave: a refund needs a positive amount")
	}
	var partialAmount json.Number
	if request.FullRefund {
		if strings.TrimSpace(request.Currency) != "" {
			currency := strings.ToUpper(strings.TrimSpace(request.Currency))
			if _, err := money.ParseCurrencyCode(currency); err != nil || !provider.SupportsCurrency(currency) {
				return interfaces.RefundResult{}, interfaces.ErrCurrencyNotSupported
			}
			request.Currency = currency
		}
	} else {
		currency := strings.ToUpper(strings.TrimSpace(request.Currency))
		if _, err := money.ParseCurrencyCode(currency); err != nil || !provider.SupportsCurrency(currency) {
			return interfaces.RefundResult{}, interfaces.ErrCurrencyNotSupported
		}
		if minimum := flutterwaveRefundMinimumMinor(currency); request.AmountMinor < minimum {
			return interfaces.RefundResult{}, fmt.Errorf("flutterwave: refund is below the documented minimum for %s", currency)
		}
		request.Currency = currency
		amount, err := flutterwaveRefundAmount(request.AmountMinor, currency)
		if err != nil {
			return interfaces.RefundResult{}, err
		}
		partialAmount = amount
	}
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
		body["amount"] = partialAmount
	}
	var refund flutterwaveRefund
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/transactions/" + url.PathEscape(request.ProviderChargeId) + "/refund", body: body}, &refund); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertFlutterwaveRefundStatus(refund.Status)}, nil
}

func (provider *FlutterwaveProvider) FindRefundByReference(ctx context.Context, lookup interfaces.RefundLookup) (interfaces.RefundResult, bool, error) {
	chargeID := lookup.ProviderChargeId
	if chargeID == "" && lookup.ChargeReference != "" {
		verification, err := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: lookup.ChargeReference})
		if err != nil {
			return interfaces.RefundResult{}, false, err
		}
		if verification.Reference != lookup.ChargeReference || verification.Outcome != interfaces.OutcomeSucceeded {
			return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave could not verify the charge for refund reconciliation"))
		}
		chargeID = verification.ProviderChargeId
	}
	if !flutterwaveChargeIdPattern.MatchString(chargeID) {
		return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave refund reconciliation requires the verified charge id"))
	}
	query := url.Values{"id": {chargeID}}
	var refunds []flutterwaveRefund
	envelope, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/refunds", query: query}, &refunds)
	if err != nil {
		return interfaces.RefundResult{}, false, err
	}
	for _, refund := range refunds {
		if interfaces.NoteCarriesRefundReference(firstNonEmptyString(refund.Comment, refund.Comments), lookup.RefundReference) {
			return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertFlutterwaveRefundStatus(refund.Status)}, true, nil
		}
	}
	// The v3 docs expose pagination metadata but omit a page query parameter for
	// this endpoint. A negative lookup is safe only when the returned page is
	// demonstrably complete; otherwise retrying could issue a duplicate refund.
	var pageInfo struct {
		PageInfo struct {
			Total       int `json:"total"`
			CurrentPage int `json:"current_page"`
			TotalPages  int `json:"total_pages"`
		} `json:"page_info"`
	}
	if len(envelope.Meta) == 0 || json.Unmarshal(envelope.Meta, &pageInfo) != nil || pageInfo.PageInfo.CurrentPage != 1 || pageInfo.PageInfo.Total < len(refunds) || pageInfo.PageInfo.TotalPages < 0 {
		return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave refund lookup omitted valid page information"))
	}
	if pageInfo.PageInfo.TotalPages == 0 {
		if pageInfo.PageInfo.Total != 0 || len(refunds) != 0 {
			return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave refund lookup returned inconsistent empty-page metadata"))
		}
		return interfaces.RefundResult{}, false, nil
	}
	if pageInfo.PageInfo.TotalPages == 1 {
		if pageInfo.PageInfo.Total > len(refunds) {
			return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave refund lookup page does not contain all reported refunds"))
		}
		return interfaces.RefundResult{}, false, nil
	}
	if pageInfo.PageInfo.TotalPages > 1 {
		return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave refund history spans multiple pages but the v3 reference does not document a page query"))
	}
	return interfaces.RefundResult{}, false, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave refund lookup returned invalid page information"))
}

func (provider *FlutterwaveProvider) ReadRefund(ctx context.Context, providerRefundId string) (interfaces.RefundResult, error) {
	var refund flutterwaveRefund
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/refunds/" + url.PathEscape(providerRefundId)}, &refund); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: refund.Id.String(), Outcome: convertFlutterwaveRefundStatus(refund.Status)}, nil
}

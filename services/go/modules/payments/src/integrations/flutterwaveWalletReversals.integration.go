package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"nantty/modules/payments/src/interfaces"
)

func (provider *FlutterwaveProvider) ReverseFunding(ctx context.Context, fundingReference, currency string) (interfaces.RefundResult, error) {
	if !strings.EqualFold(currency, "NGN") {
		return interfaces.RefundResult{}, interfaces.ErrCurrencyNotSupported
	}
	body := map[string]any{"funding_reference": strings.TrimPrefix(fundingReference, "PSA_"), "debit_currency": currency}
	var reversal struct {
		Id        json.Number `json:"id"`
		Reference string      `json:"reference"`
		Status    string      `json:"status"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/payout-subaccounts/refunds", body: body}, &reversal); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: firstNonEmptyString(reversal.Reference, flutterwaveNumericReference(reversal.Id)), Outcome: convertFlutterwaveTransferLikeStatus(reversal.Status)}, nil
}

func flutterwaveNumericReference(value json.Number) string {
	if value == "" || value == "0" {
		return ""
	}
	return value.String()
}

func convertFlutterwaveTransferLikeStatus(status string) interfaces.ProviderOutcome {
	switch strings.ToUpper(status) {
	case "SUCCESSFUL", "SUCCESS":
		return interfaces.OutcomeSucceeded
	case "FAILED":
		return interfaces.OutcomeFailed
	}
	return interfaces.OutcomePending
}

func (provider *FlutterwaveProvider) ListFundingReversals(ctx context.Context, from, to time.Time) ([]interfaces.FundingReversal, error) {
	query := url.Values{"from": {from.UTC().Format("2006-01-02")}, "to": {to.UTC().Format("2006-01-02")}}
	type reversalRow struct {
		Id               json.Number     `json:"id"`
		Reference        string          `json:"reference"`
		FundingReference string          `json:"funding_reference"`
		Narration        string          `json:"narration"`
		Status           string          `json:"status"`
		Amount           json.RawMessage `json:"amount"`
		Currency         string          `json:"currency"`
		AccountReference string          `json:"account_reference"`
	}
	var reversals []interfaces.FundingReversal
	const maxPages = 100
	for _, status := range []string{"SUCCESSFUL", "PENDING", "FAILED"} {
		query.Set("status", status)
		for page := 1; page <= maxPages; page++ {
			query.Set("page", strconv.Itoa(page))
			var result struct {
				PageInfo struct {
					CurrentPage int `json:"current_page"`
					TotalPages  int `json:"total_pages"`
				} `json:"page_info"`
				Transfers []reversalRow `json:"transfers"`
			}
			if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts/refunds", query: query}, &result); err != nil {
				return nil, err
			}
			if result.PageInfo.CurrentPage != page || result.PageInfo.TotalPages < 0 || (result.PageInfo.TotalPages == 0 && len(result.Transfers) > 0) || result.PageInfo.TotalPages > 0 && result.PageInfo.TotalPages < page {
				return nil, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave reversal listing omitted or returned inconsistent page information"))
			}
			for _, row := range result.Transfers {
				currency := strings.ToUpper(firstNonEmptyString(row.Currency, "NGN"))
				if currency != "NGN" {
					return nil, interfaces.ErrCurrencyNotSupported
				}
				amount, err := flutterwaveAmountMinor(row.Amount, currency)
				if err != nil {
					return nil, err
				}
				fundingReference := firstNonEmptyString(row.FundingReference, flutterwaveFundingReferenceFromNarration(row.Narration))
				if fundingReference == "" {
					return nil, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave reversal omitted its original funding reference"))
				}
				providerReference := firstNonEmptyString(row.Reference, flutterwaveNumericReference(row.Id))
				if providerReference == "" {
					return nil, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave reversal omitted its provider reference"))
				}
				reversals = append(reversals, interfaces.FundingReversal{
					FundingReference: fundingReference, ProviderReversalReference: providerReference, AccountRef: row.AccountReference,
					AmountMinor: amount, Currency: currency, Outcome: convertFlutterwaveTransferLikeStatus(row.Status),
				})
			}
			if result.PageInfo.TotalPages == 0 || result.PageInfo.TotalPages == page {
				break
			}
			if page == maxPages {
				return nil, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave reversal listing exceeded the pagination limit"))
			}
		}
	}
	return reversals, nil
}

func flutterwaveFundingReferenceFromNarration(narration string) string {
	const prefix = "Refund for: "
	narration = strings.TrimSpace(narration)
	if !strings.HasPrefix(narration, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(narration, prefix))
}

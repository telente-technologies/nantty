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

type bachsTransferResponse struct {
	Id     string `json:"id"`
	Status string `json:"status"`
}

func (transfer bachsTransferResponse) toResult() interfaces.TransferResult {
	result := interfaces.TransferResult{ProviderTransferId: transfer.Id, Outcome: interfaces.OutcomePending}
	if transfer.Status == "paid" {
		result.Outcome = interfaces.OutcomeSucceeded
	}
	return result
}

func (provider *BachsConnectProvider) CreateTransfer(ctx context.Context, request interfaces.TransferRequest) (interfaces.TransferResult, error) {
	if (request.FromConnectedAccountId == "") == (request.ToConnectedAccountId == "") {
		return interfaces.TransferResult{}, errors.New("bachs: a transfer runs between the platform and exactly one connected account")
	}
	amount, err := decimalAmount(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.TransferResult{}, err
	}
	destination := request.ToConnectedAccountId
	if request.FromConnectedAccountId != "" {
		destination = "self"
	}
	body := map[string]any{"destination": destination, "amount": amount, "currency": request.Currency, "transfer_group": request.TransferGroup, "description": truncate(request.Description, 200), "metadata": request.Metadata}
	var response bachsTransferResponse
	err = provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/transfers", body: body, connectedAccountId: request.FromConnectedAccountId, idempotencyKey: request.IdempotencyKey}, &response)
	if err != nil {
		return interfaces.TransferResult{}, err
	}
	return response.toResult(), nil
}

func (provider *BachsConnectProvider) ReadTransfer(ctx context.Context, providerTransferId string) (interfaces.TransferResult, error) {
	var response bachsTransferResponse
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/transfers/" + url.PathEscape(providerTransferId)}, &response); err != nil {
		return interfaces.TransferResult{}, err
	}
	return response.toResult(), nil
}

func (provider *BachsConnectProvider) CreatePayoutDestination(ctx context.Context, request interfaces.PayoutDestinationRequest) (interfaces.PayoutDestination, error) {
	var response struct {
		Id          string `json:"id"`
		Status      string `json:"status"`
		IsUsable    bool   `json:"is_usable"`
		AccountName string `json:"account_name"`
	}
	body := map[string]any{"currency": request.Currency, "account_number": request.AccountNumber, "bank_code": request.BankCode}
	err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/payouts/destinations", body: body, connectedAccountId: request.ConnectedAccountId, idempotencyKey: request.IdempotencyKey}, &response)
	if err != nil {
		return interfaces.PayoutDestination{}, err
	}
	return interfaces.PayoutDestination{ProviderDestinationId: response.Id, AccountName: response.AccountName, Usable: response.IsUsable && response.Status == "approved"}, nil
}

type bachsPayoutResponse struct {
	Id            string  `json:"id"`
	Status        string  `json:"status"`
	Currency      string  `json:"currency"`
	Fee           *string `json:"fee"`
	TotalDebited  *string `json:"total_debited"`
	FailureReason *string `json:"failure_reason"`
}

func (payout bachsPayoutResponse) toResult(currency string) interfaces.PayoutResult {
	if payout.Currency != "" {
		currency = strings.ToUpper(payout.Currency)
	}
	result := interfaces.PayoutResult{ProviderPayoutId: payout.Id, Outcome: interfaces.OutcomePending, FeeMinor: minorAmount(payout.Fee, currency), TotalDebitedMinor: minorAmount(payout.TotalDebited, currency)}
	switch payout.Status {
	case "completed", "paid":
		result.Outcome = interfaces.OutcomeSucceeded
	case "failed":
		result.Outcome = interfaces.OutcomeFailed
		if payout.FailureReason != nil {
			result.FailureReason = truncate(*payout.FailureReason, 200)
		}
	}
	return result
}

func (provider *BachsConnectProvider) CreatePayout(ctx context.Context, request interfaces.PayoutRequest) (interfaces.PayoutResult, error) {
	amount, err := decimalAmount(request.AmountMinor, request.Currency)
	if err != nil {
		return interfaces.PayoutResult{}, err
	}
	body := map[string]any{"destination": request.ProviderDestinationId, "amount": amount, "reference": request.Reference}
	var response bachsPayoutResponse
	err = provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/payouts", body: body, connectedAccountId: request.ConnectedAccountId, idempotencyKey: request.IdempotencyKey}, &response)
	if err != nil {
		return interfaces.PayoutResult{}, err
	}
	return response.toResult(request.Currency), nil
}

func (provider *BachsConnectProvider) ReadPayout(ctx context.Context, lookup interfaces.PayoutLookup) (interfaces.PayoutResult, error) {
	var response bachsPayoutResponse
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/payouts/" + url.PathEscape(lookup.ProviderPayoutId), connectedAccountId: lookup.ConnectedAccountId}, &response); err != nil {
		return interfaces.PayoutResult{}, err
	}
	return response.toResult(""), nil
}

func (provider *BachsConnectProvider) ReadBalances(ctx context.Context, connectedAccountId string) ([]interfaces.ProviderBalance, error) {
	var response struct {
		Balances []struct {
			Currency         string  `json:"currency"`
			AvailableBalance *string `json:"available_balance"`
			PendingBalance   *string `json:"pending_balance"`
		} `json:"balances"`
	}
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/balances", connectedAccountId: connectedAccountId}, &response); err != nil {
		return nil, err
	}
	balances := make([]interfaces.ProviderBalance, 0, len(response.Balances))
	for _, balance := range response.Balances {
		currency := strings.ToUpper(balance.Currency)
		balances = append(balances, interfaces.ProviderBalance{Currency: currency, AvailableMinor: signedMinorAmount(balance.AvailableBalance, currency), PendingMinor: signedMinorAmount(balance.PendingBalance, currency)})
	}
	return balances, nil
}

func signedMinorAmount(raw *string, currency string) int64 {
	if raw != nil && strings.HasPrefix(*raw, "-") {
		positive := strings.TrimPrefix(*raw, "-")
		return -minorAmount(&positive, currency)
	}
	return minorAmount(raw, currency)
}

func (provider *BachsConnectProvider) QuotePayoutFee(currency string, amountMinor int64) (int64, error) {
	rule, known := provider.settings.payoutFeeRule(currency)
	if !known {
		return 0, fmt.Errorf("%w: no payout fee known for %s", interfaces.ErrCurrencyNotSupported, currency)
	}
	return rule.Quote(amountMinor), nil
}

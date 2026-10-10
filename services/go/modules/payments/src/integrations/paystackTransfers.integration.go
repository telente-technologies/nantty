package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

type paystackTransfer struct {
	TransferCode string      `json:"transfer_code"`
	Reference    string      `json:"reference"`
	Status       string      `json:"status"`
	Fee          json.Number `json:"fee"`
	Reason       string      `json:"reason"`
	Failures     any         `json:"failures"`
}

func (transfer paystackTransfer) toResult() interfaces.TransferResult {
	result := interfaces.TransferResult{ProviderTransferId: transfer.TransferCode, Outcome: interfaces.OutcomePending, FeeMinor: numberValue(transfer.Fee)}
	switch transfer.Status {
	case "success":
		result.Outcome = interfaces.OutcomeSucceeded
	case "failed", "reversed", "abandoned", "rejected":
		result.Outcome, result.FailureReason = interfaces.OutcomeFailed, "transfer "+transfer.Status
	}
	return result
}

func (provider *PaystackProvider) CreateTransfer(ctx context.Context, request interfaces.TransferRequest) (interfaces.TransferResult, error) {
	if request.RecipientCode == "" || len(request.Reference) < 16 {
		return interfaces.TransferResult{}, errors.New("paystack: a transfer needs a recipient and a reference of at least 16 characters")
	}
	body := map[string]any{
		"source": "balance", "amount": request.AmountMinor, "currency": request.Currency, "recipient": request.RecipientCode,
		"reference": strings.ToLower(request.Reference), "reason": truncate(request.Reason, 100),
	}
	var transfer paystackTransfer
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/transfer", body: body, retrySafe: false}, &transfer); err != nil {
		return interfaces.TransferResult{}, err
	}
	if transfer.Status == "otp" {
		return transfer.toResult(), interfaces.ErrTransferNeedsOtp
	}
	return transfer.toResult(), nil
}

func (provider *PaystackProvider) VerifyTransfer(ctx context.Context, reference string) (interfaces.TransferResult, error) {
	var transfer paystackTransfer
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/transfer/verify/" + url.PathEscape(strings.ToLower(reference))}, &transfer); err != nil {
		return interfaces.TransferResult{}, err
	}
	return transfer.toResult(), nil
}

func (provider *PaystackProvider) ReadPlatformBalances(ctx context.Context) ([]interfaces.ProviderBalance, error) {
	var rows []struct {
		Currency string      `json:"currency"`
		Balance  json.Number `json:"balance"`
	}
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/balance"}, &rows); err != nil {
		return nil, err
	}
	balances := make([]interfaces.ProviderBalance, 0, len(rows))
	for _, row := range rows {
		balances = append(balances, interfaces.ProviderBalance{Currency: strings.ToUpper(row.Currency), AvailableMinor: numberValue(row.Balance)})
	}
	return balances, nil
}

func (provider *PaystackProvider) ListSettlements(ctx context.Context, subaccountCode string, from, to time.Time) ([]interfaces.ProviderSettlement, error) {
	var page paystackPage[struct {
		Id          flexibleId  `json:"id"`
		Status      string      `json:"status"`
		Currency    string      `json:"currency"`
		TotalAmount json.Number `json:"total_amount"`
		SettledDate *string     `json:"settlement_date"`
	}]
	query := url.Values{"perPage": {"100"}, "from": {from.UTC().Format(time.RFC3339)}, "to": {to.UTC().Format(time.RFC3339)}}
	if subaccountCode != "" {
		query.Set("subaccount", subaccountCode)
	}
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/settlement", query: query}, &page); err != nil {
		return nil, err
	}
	settlements := make([]interfaces.ProviderSettlement, 0, len(page.Items))
	for _, item := range page.Items {
		settlements = append(settlements, interfaces.ProviderSettlement{
			ProviderSettlementId: string(item.Id), SubaccountCode: subaccountCode, Status: item.Status, AmountMinor: numberValue(item.TotalAmount),
			Currency: strings.ToUpper(item.Currency), SettledAt: optionalTime(item.SettledDate),
		})
	}
	return settlements, nil
}

func (provider *PaystackProvider) ListSettlementChargeReferences(ctx context.Context, providerSettlementId string) ([]string, error) {
	var page paystackPage[struct {
		Reference string `json:"reference"`
	}]
	path := fmt.Sprintf("/settlement/%s/transactions", url.PathEscape(providerSettlementId))
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: path, query: url.Values{"perPage": {"100"}}}, &page); err != nil {
		return nil, err
	}
	references := make([]string, 0, len(page.Items))
	for _, item := range page.Items {
		references = append(references, item.Reference)
	}
	return references, nil
}

type flexibleId string

func (identifier *flexibleId) UnmarshalJSON(raw []byte) error {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		*identifier = flexibleId(text)
		return nil
	}
	var number json.Number
	if err := json.Unmarshal(raw, &number); err != nil {
		return err
	}
	*identifier = flexibleId(number.String())
	return nil
}

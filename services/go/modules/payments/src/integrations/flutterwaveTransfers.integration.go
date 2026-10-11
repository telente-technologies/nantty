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

	"zudomart/modules/payments/src/interfaces"
)

type flutterwaveTransfer struct {
	Id               json.Number     `json:"id"`
	Reference        string          `json:"reference"`
	Status           string          `json:"status"`
	Amount           json.RawMessage `json:"amount"`
	Fee              json.RawMessage `json:"fee"`
	Currency         string          `json:"currency"`
	CompleteMessage  string          `json:"complete_message"`
	RequiresApproval json.Number     `json:"requires_approval"`
	IsApproved       json.Number     `json:"is_approved"`
}

func (transfer flutterwaveTransfer) toResult() interfaces.TransferResult {
	result := interfaces.TransferResult{ProviderTransferId: transfer.Id.String(), Outcome: interfaces.OutcomePending, FeeMinor: flutterwaveFeeMinor(transfer.Fee, strings.ToUpper(transfer.Currency))}
	switch strings.ToUpper(transfer.Status) {
	case "SUCCESSFUL":
		result.Outcome = interfaces.OutcomeSucceeded
	case "FAILED":
		result.Outcome, result.FailureReason = interfaces.OutcomeFailed, truncate("transfer failed: "+transfer.CompleteMessage, 200)
	}
	if transfer.RequiresApproval.String() == "1" && transfer.IsApproved.String() != "1" && result.Outcome == interfaces.OutcomePending {
		result.FailureReason = "awaiting dashboard approval"
	}
	return result
}

func (provider *FlutterwaveProvider) transferBody(reference, currency string, amountMinor int64, narration string) map[string]any {
	body := map[string]any{
		"amount": majorUnits(amountMinor, currency), "currency": currency, "debit_currency": currency, "reference": reference,
		"narration": truncate(narration, 100), "skip_beneficiary_creation": 1,
	}
	if provider.settings.TransferCallbackUrl != "" {
		body["callback_url"] = provider.settings.TransferCallbackUrl
	}
	return body
}

func (provider *FlutterwaveProvider) CreateTransfer(ctx context.Context, request interfaces.TransferRequest) (interfaces.TransferResult, error) {
	if request.BankCode == "" || request.AccountNumber == "" || request.Reference == "" || request.AmountMinor <= 0 {
		return interfaces.TransferResult{}, errors.New("flutterwave: a payout needs a bank code, an account number, a reference and a positive amount")
	}
	body := provider.transferBody(request.Reference, request.Currency, request.AmountMinor, firstNonEmptyString(request.Reason, "Zudomart withdrawal"))
	body["account_bank"], body["account_number"] = request.BankCode, request.AccountNumber
	if request.BeneficiaryName != "" {
		body["beneficiary_name"] = request.BeneficiaryName
	}
	if request.SourceWalletRef != "" {
		body["debit_subaccount"] = request.SourceWalletRef
	}
	if request.BranchCode != "" {
		body["destination_branch_code"] = request.BranchCode
	}
	return provider.postTransfer(ctx, body)
}

func (provider *FlutterwaveProvider) postTransfer(ctx context.Context, body map[string]any) (interfaces.TransferResult, error) {
	var transfer flutterwaveTransfer
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/transfers", body: body}, &transfer); err != nil {
		return interfaces.TransferResult{}, err
	}
	result := transfer.toResult()
	if result.Outcome == interfaces.OutcomeSucceeded {
		result.Outcome = interfaces.OutcomePending
	}
	return result, nil
}

func (provider *FlutterwaveProvider) VerifyTransfer(ctx context.Context, reference string) (interfaces.TransferResult, error) {
	var transfers []flutterwaveTransfer
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/transfers", query: url.Values{"reference": {reference}}}, &transfers); err != nil {
		return interfaces.TransferResult{}, err
	}
	for _, transfer := range transfers {
		if transfer.Reference == reference {
			return transfer.toResult(), nil
		}
	}
	return interfaces.TransferResult{}, &ProviderRequestError{Provider: FlutterwaveProviderName, StatusCode: http.StatusNotFound, Message: "no transfer with this reference"}
}

func (provider *FlutterwaveProvider) ReadPlatformBalances(ctx context.Context) ([]interfaces.ProviderBalance, error) {
	var rows []struct {
		Currency         string          `json:"currency"`
		AvailableBalance json.RawMessage `json:"available_balance"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/balances"}, &rows); err != nil {
		return nil, err
	}
	balances := make([]interfaces.ProviderBalance, 0, len(rows))
	for _, row := range rows {
		currency := strings.ToUpper(row.Currency)
		amount, err := flutterwaveAmountMinor(row.AvailableBalance, currency)
		if err != nil {
			return nil, err
		}
		balances = append(balances, interfaces.ProviderBalance{Currency: currency, AvailableMinor: amount})
	}
	return balances, nil
}

type flutterwaveSettlement struct {
	Id          json.Number     `json:"id"`
	Status      string          `json:"status"`
	Currency    string          `json:"currency"`
	NetAmount   json.RawMessage `json:"net_amount"`
	DueDate     string          `json:"due_date"`
	SettledAt   string          `json:"settlement_date"`
	Destination string          `json:"destination"`
}

func (provider *FlutterwaveProvider) ListSettlements(ctx context.Context, subaccountCode string, from, to time.Time) ([]interfaces.ProviderSettlement, error) {
	query := url.Values{"from": {from.UTC().Format("2006-01-02")}, "to": {to.UTC().Format("2006-01-02")}}
	if subaccountCode != "" {
		query.Set("subaccount_id", subaccountCode)
	}
	var settlements []interfaces.ProviderSettlement
	for page := 1; page <= 50; page++ {
		query.Set("page", strconv.Itoa(page))
		var rows []flutterwaveSettlement
		envelope, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/settlements", query: query}, &rows)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			currency := strings.ToUpper(row.Currency)
			amount, err := flutterwaveAmountMinor(row.NetAmount, currency)
			if err != nil {
				return nil, err
			}
			settledAt := flutterwaveTime(firstNonEmptyString(row.SettledAt, row.DueDate))
			settlements = append(settlements, interfaces.ProviderSettlement{
				ProviderSettlementId: row.Id.String(), SubaccountCode: subaccountCode, Status: convertFlutterwaveSettlementStatus(row.Status),
				AmountMinor: amount, Currency: currency, SettledAt: settledAt,
			})
		}
		if !hasNextFlutterwavePage(envelope.Meta, page) {
			break
		}
	}
	return settlements, nil
}

func convertFlutterwaveSettlementStatus(status string) string {
	switch strings.ToLower(status) {
	case "completed", "completed-offline", "approved", "successful":
		return "success"
	case "failed", "flagged":
		return "failed"
	}
	return "pending"
}

func hasNextFlutterwavePage(meta json.RawMessage, page int) bool {
	var decoded struct {
		PageInfo struct {
			TotalPages  int `json:"total_pages"`
			CurrentPage int `json:"current_page"`
		} `json:"page_info"`
	}
	if json.Unmarshal(meta, &decoded) != nil {
		return false
	}
	return decoded.PageInfo.TotalPages > page
}

func (provider *FlutterwaveProvider) ListSettlementChargeReferences(ctx context.Context, providerSettlementId string) ([]string, error) {
	var settlement struct {
		Transactions []struct {
			TxRef string `json:"tx_ref"`
		} `json:"transactions"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/settlements/" + url.PathEscape(providerSettlementId)}, &settlement); err != nil {
		return nil, err
	}
	references := make([]string, 0, len(settlement.Transactions))
	for _, transaction := range settlement.Transactions {
		references = append(references, transaction.TxRef)
	}
	return references, nil
}

func (provider *FlutterwaveProvider) QuotePayoutFee(currency string, amountMinor int64) (int64, error) {
	if !provider.SupportsCurrency(currency) {
		return 0, interfaces.ErrCurrencyNotSupported
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	query := url.Values{"amount": {majorUnits(amountMinor, currency).String()}, "currency": {currency}, "type": {"account"}}
	var fees []struct {
		Currency string          `json:"currency"`
		Fee      json.RawMessage `json:"fee"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/transfers/fee", query: query}, &fees); err != nil {
		return 0, err
	}
	for _, fee := range fees {
		if strings.EqualFold(fee.Currency, currency) {
			return flutterwaveFeeMinor(fee.Fee, currency), nil
		}
	}
	return 0, interfaces.ErrCurrencyNotSupported
}

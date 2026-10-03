package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

func (provider *PaystackProvider) ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	var response struct {
		AccountName string `json:"account_name"`
	}
	query := url.Values{"account_number": {accountNumber}, "bank_code": {bankCode}}
	err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/bank/resolve", query: query}, &response)
	var requestError *ProviderRequestError
	if errors.As(err, &requestError) && requestError.IsDefinitiveRejection() {
		return "", interfaces.ErrBankAccountNotFound
	}
	if err != nil {
		return "", err
	}
	if response.AccountName == "" {
		return "", interfaces.ErrBankAccountNotFound
	}
	return response.AccountName, nil
}

func (provider *PaystackProvider) ListBanks(ctx context.Context, countryCode string) ([]interfaces.Bank, error) {
	if countryCode != "NG" {
		return nil, interfaces.ErrCurrencyNotSupported
	}
	var page paystackPage[struct {
		Code   string `json:"code"`
		Name   string `json:"name"`
		Active bool   `json:"active"`
	}]
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/bank", query: url.Values{"currency": {"NGN"}, "perPage": {"100"}}}, &page); err != nil {
		return nil, err
	}
	banks := make([]interfaces.Bank, 0, len(page.Items))
	for _, bank := range page.Items {
		if bank.Active || bank.Code != "" {
			banks = append(banks, interfaces.Bank{Code: bank.Code, Name: bank.Name, CountryCode: countryCode})
		}
	}
	return banks, nil
}

type paystackRecipient struct {
	RecipientCode string          `json:"recipient_code"`
	Metadata      json.RawMessage `json:"metadata"`
	Details       struct {
		AccountNumber string `json:"account_number"`
		BankCode      string `json:"bank_code"`
	} `json:"details"`
}

func metadataUserId(raw json.RawMessage) string {
	var metadata struct {
		ZudomartUserId string `json:"zudomartUserId"`
	}
	_ = json.Unmarshal(raw, &metadata)
	return metadata.ZudomartUserId
}

func (provider *PaystackProvider) FindTransferRecipient(ctx context.Context, account interfaces.PayeeBankAccount) (string, bool, error) {
	for pageNumber := 1; pageNumber <= 3; pageNumber++ {
		var page paystackPage[paystackRecipient]
		query := url.Values{"perPage": {"100"}, "page": {fmt.Sprint(pageNumber)}}
		if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/transferrecipient", query: query}, &page); err != nil {
			return "", false, err
		}
		for _, recipient := range page.Items {
			if recipient.Details.AccountNumber == account.AccountNumber && recipient.Details.BankCode == account.BankCode && metadataUserId(recipient.Metadata) == account.UserId {
				return recipient.RecipientCode, true, nil
			}
		}
		if page.Meta.PageCount <= pageNumber {
			break
		}
	}
	return "", false, nil
}

func (provider *PaystackProvider) CreateTransferRecipient(ctx context.Context, account interfaces.PayeeBankAccount) (string, error) {
	body := map[string]any{
		"type": "nuban", "name": account.AccountName, "account_number": account.AccountNumber, "bank_code": account.BankCode,
		"currency": firstNonEmptyString(account.Currency, "NGN"), "metadata": map[string]any{"zudomartUserId": account.UserId},
	}
	var response paystackRecipient
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/transferrecipient", body: body}, &response); err != nil {
		return "", err
	}
	if !strings.HasPrefix(response.RecipientCode, "RCP_") {
		return "", fmt.Errorf("%w: paystack returned no recipient code", interfaces.ErrProviderUnavailable)
	}
	return response.RecipientCode, nil
}

type paystackSubaccount struct {
	SubaccountCode     string          `json:"subaccount_code"`
	AccountNumber      string          `json:"account_number"`
	SettlementBank     string          `json:"settlement_bank"`
	SettlementSchedule string          `json:"settlement_schedule"`
	Metadata           json.RawMessage `json:"metadata"`
}

func (provider *PaystackProvider) FindSettlementSubaccount(ctx context.Context, request interfaces.SettlementSubaccountRequest) (string, bool, error) {
	for pageNumber := 1; pageNumber <= 3; pageNumber++ {
		var page paystackPage[paystackSubaccount]
		query := url.Values{"perPage": {"100"}, "page": {fmt.Sprint(pageNumber)}}
		if err := provider.http.send(ctx, paystackRequest{method: http.MethodGet, path: "/subaccount", query: query}, &page); err != nil {
			return "", false, err
		}
		for _, subaccount := range page.Items {
			manual := subaccount.SettlementSchedule == "manual" || subaccount.SettlementSchedule == "MANUAL"
			if subaccount.AccountNumber == request.AccountNumber && metadataUserId(subaccount.Metadata) == request.UserId && manual == request.ManualSettlement {
				return subaccount.SubaccountCode, true, nil
			}
		}
		if page.Meta.PageCount <= pageNumber {
			break
		}
	}
	return "", false, nil
}

func (provider *PaystackProvider) CreateSettlementSubaccount(ctx context.Context, request interfaces.SettlementSubaccountRequest) (string, error) {
	body := map[string]any{
		"business_name": truncate(firstNonEmptyString(request.BusinessName, request.AccountName), 100), "bank_code": request.BankCode, "account_number": request.AccountNumber,
		"percentage_charge": 0, "metadata": map[string]any{"zudomartUserId": request.UserId, "purpose": map[bool]string{true: "escrow", false: "settlement"}[request.ManualSettlement]},
	}
	var created paystackSubaccount
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/subaccount", body: body}, &created); err != nil {
		return "", err
	}
	if !strings.HasPrefix(created.SubaccountCode, "ACCT_") {
		return "", fmt.Errorf("%w: paystack returned no subaccount code", interfaces.ErrProviderUnavailable)
	}
	schedule := map[bool]string{true: "manual", false: "auto"}[request.ManualSettlement]
	if err := provider.http.send(ctx, paystackRequest{method: http.MethodPut, path: "/subaccount/" + url.PathEscape(created.SubaccountCode), body: map[string]any{"settlement_schedule": schedule}, retrySafe: true}, nil); err != nil {
		return "", err
	}
	return created.SubaccountCode, nil
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

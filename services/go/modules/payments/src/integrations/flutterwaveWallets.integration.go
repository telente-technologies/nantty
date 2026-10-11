package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"zudomart/modules/payments/src/integrations/providerHttp"
	"zudomart/modules/payments/src/interfaces"
)

type flutterwaveSubaccount struct {
	AccountReference string `json:"account_reference"`
	BarterId         string `json:"barter_id"`
	Nuban            string `json:"nuban"`
	BankName         string `json:"bank_name"`
	BankCode         string `json:"bank_code"`
	Status           string `json:"status"`
	Email            string `json:"email"`
}

func (account flutterwaveSubaccount) toWallet() interfaces.ProviderWallet {
	return interfaces.ProviderWallet{
		AccountRef: account.AccountReference, BarterId: account.BarterId, Nuban: account.Nuban, BankCode: account.BankCode,
		BankName: account.BankName, Currency: "NGN", Status: strings.ToUpper(account.Status),
	}
}

func (provider *FlutterwaveProvider) CreateWallet(ctx context.Context, owner interfaces.WalletOwner) (interfaces.ProviderWallet, error) {
	if owner.AccountName == "" || owner.AliasEmail == "" {
		return interfaces.ProviderWallet{}, errors.New("flutterwave: a wallet needs the verified name and the alias email")
	}
	if existing, found, err := provider.findWallet(ctx, url.Values{"email": {owner.AliasEmail}}); err != nil || found {
		return existing, err
	}
	country := firstNonEmptyString(owner.Country, "NG")
	body := map[string]any{"account_name": truncate(owner.AccountName, 100), "email": owner.AliasEmail, "mobilenumber": owner.MobileNo, "country": country}
	var account flutterwaveSubaccount
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/payout-subaccounts", body: body}, &account)
	if errors.Is(err, providerhttp.ErrOutcomeUnknown) || isDefinitiveFlutterwaveRejection(err) {
		if existing, found, lookupErr := provider.findWallet(ctx, url.Values{"email": {owner.AliasEmail}}); lookupErr == nil && found {
			return existing, nil
		}
	}
	if err != nil {
		return interfaces.ProviderWallet{}, err
	}
	if account.AccountReference == "" || account.BarterId == "" {
		return interfaces.ProviderWallet{}, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave returned a wallet without a reference"))
	}
	return account.toWallet(), nil
}

func (provider *FlutterwaveProvider) findWallet(ctx context.Context, query url.Values) (interfaces.ProviderWallet, bool, error) {
	var accounts []flutterwaveSubaccount
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts", query: query}, &accounts)
	if isFlutterwaveNotFound(err) {
		return interfaces.ProviderWallet{}, false, nil
	}
	if err != nil {
		return interfaces.ProviderWallet{}, false, err
	}
	for _, account := range accounts {
		if account.AccountReference != "" {
			return account.toWallet(), true, nil
		}
	}
	return interfaces.ProviderWallet{}, false, nil
}

func (provider *FlutterwaveProvider) FindWalletByAccountNumber(ctx context.Context, accountNumber string) (interfaces.ProviderWallet, bool, error) {
	return provider.findWallet(ctx, url.Values{"nuban": {accountNumber}})
}

func (provider *FlutterwaveProvider) FetchWallet(ctx context.Context, accountRef string) (interfaces.ProviderWallet, error) {
	var account flutterwaveSubaccount
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts/" + url.PathEscape(accountRef)}, &account); err != nil {
		return interfaces.ProviderWallet{}, err
	}
	return account.toWallet(), nil
}

func (provider *FlutterwaveProvider) ListFundingAccounts(ctx context.Context, accountRef, currency string) ([]interfaces.FundingAccount, error) {
	var raw json.RawMessage
	query := url.Values{"currency": {currency}, "verbose": {"1"}}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts/" + url.PathEscape(accountRef) + "/static-account", query: query}, &raw); err != nil {
		return nil, err
	}
	type staticAccount struct {
		StaticAccount string `json:"static_account"`
		AccountNumber string `json:"account_number"`
		BankName      string `json:"bank_name"`
		BankCode      string `json:"bank_code"`
	}
	var rows []staticAccount
	if trimmed := bytes.TrimSpace(raw); len(trimmed) > 0 && trimmed[0] == '[' {
		if err := json.Unmarshal(trimmed, &rows); err != nil {
			return nil, errors.Join(interfaces.ErrProviderUnavailable, err)
		}
	} else {
		var single staticAccount
		if err := json.Unmarshal(trimmed, &single); err != nil {
			return nil, errors.Join(interfaces.ErrProviderUnavailable, err)
		}
		rows = append(rows, single)
	}
	accounts := make([]interfaces.FundingAccount, 0, len(rows))
	for _, row := range rows {
		if number := firstNonEmptyString(row.StaticAccount, row.AccountNumber); number != "" {
			accounts = append(accounts, interfaces.FundingAccount{AccountNumber: number, BankCode: row.BankCode, BankName: row.BankName, Currency: currency})
		}
	}
	return accounts, nil
}

func (provider *FlutterwaveProvider) ReadWalletBalance(ctx context.Context, accountRef, currency string) (interfaces.ProviderBalance, error) {
	var balance struct {
		Currency         string          `json:"currency"`
		AvailableBalance json.RawMessage `json:"available_balance"`
	}
	path := "/payout-subaccounts/" + url.PathEscape(accountRef) + "/balances"
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: path, query: url.Values{"currency": {currency}}}, &balance); err != nil {
		return interfaces.ProviderBalance{}, err
	}
	amount, err := flutterwaveAmountMinor(balance.AvailableBalance, currency)
	if err != nil {
		return interfaces.ProviderBalance{}, err
	}
	return interfaces.ProviderBalance{Currency: currency, AvailableMinor: amount}, nil
}

type flutterwaveWalletLine struct {
	Type      string          `json:"type"`
	Amount    json.RawMessage `json:"amount"`
	Currency  string          `json:"currency"`
	Reference string          `json:"reference"`
	Remarks   string          `json:"remarks"`
	Date      string          `json:"date"`
}

func (provider *FlutterwaveProvider) ListWalletTransactions(ctx context.Context, accountRef string, from, to time.Time) ([]interfaces.WalletLine, error) {
	query := url.Values{"from": {from.UTC().Format("2006-01-02")}, "to": {to.UTC().Format("2006-01-02")}, "currency": {"NGN"}}
	var raw json.RawMessage
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts/" + url.PathEscape(accountRef) + "/transactions", query: query}, &raw); err != nil {
		return nil, err
	}
	var rows []flutterwaveWalletLine
	if trimmed := bytes.TrimSpace(raw); len(trimmed) > 0 && trimmed[0] == '[' {
		if err := json.Unmarshal(trimmed, &rows); err != nil {
			return nil, errors.Join(interfaces.ErrProviderUnavailable, err)
		}
	} else {
		var wrapped struct {
			Transactions []flutterwaveWalletLine `json:"transactions"`
		}
		if err := json.Unmarshal(trimmed, &wrapped); err != nil {
			return nil, errors.Join(interfaces.ErrProviderUnavailable, err)
		}
		rows = wrapped.Transactions
	}
	lines := make([]interfaces.WalletLine, 0, len(rows))
	for _, row := range rows {
		currency := strings.ToUpper(firstNonEmptyString(row.Currency, "NGN"))
		amount, err := flutterwaveAmountMinor(row.Amount, currency)
		if err != nil {
			return nil, err
		}
		direction := "credit"
		if strings.EqualFold(row.Type, "D") {
			direction = "debit"
		}
		line := interfaces.WalletLine{Reference: row.Reference, Direction: direction, AmountMinor: amount, Currency: currency, Narration: row.Remarks}
		if occurred := flutterwaveTime(row.Date); occurred != nil {
			line.OccurredAt = *occurred
		}
		lines = append(lines, line)
	}
	return lines, nil
}

func (provider *FlutterwaveProvider) MoveBetweenWallets(ctx context.Context, move interfaces.WalletMove) (interfaces.TransferResult, error) {
	destination := move.ToBarterId
	if move.ToPlatformBalance {
		destination = provider.settings.MerchantId
	}
	if destination == "" || move.Reference == "" || move.AmountMinor <= 0 || (move.FromAccountRef == "" && !move.FromPlatformBalance) || (move.FromPlatformBalance && move.ToPlatformBalance) {
		return interfaces.TransferResult{}, errors.New("flutterwave: a wallet move needs a source, a destination, a reference and a positive amount")
	}
	body := provider.transferBody(move.Reference, move.Currency, move.AmountMinor, firstNonEmptyString(move.Narration, "Zudomart wallet transfer"))
	body["account_bank"], body["account_number"] = "flutterwave", destination
	if !move.FromPlatformBalance {
		body["debit_subaccount"] = move.FromAccountRef
	}
	return provider.postTransfer(ctx, body)
}

func (provider *FlutterwaveProvider) ReverseFunding(ctx context.Context, fundingReference, currency string) (interfaces.RefundResult, error) {
	body := map[string]any{"funding_reference": strings.TrimPrefix(fundingReference, "PSA_"), "debit_currency": currency}
	var reversal struct {
		Id     json.Number `json:"id"`
		Status string      `json:"status"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/payout-subaccounts/refunds", body: body}, &reversal); err != nil {
		return interfaces.RefundResult{}, err
	}
	return interfaces.RefundResult{ProviderRefundId: reversal.Id.String(), Outcome: convertFlutterwaveTransferLikeStatus(reversal.Status)}, nil
}

func convertFlutterwaveTransferLikeStatus(status string) interfaces.ProviderOutcome {
	switch strings.ToUpper(status) {
	case "SUCCESSFUL", "SUCCESS", "COMPLETED":
		return interfaces.OutcomeSucceeded
	case "FAILED":
		return interfaces.OutcomeFailed
	}
	return interfaces.OutcomePending
}

func (provider *FlutterwaveProvider) ListFundingReversals(ctx context.Context, from, to time.Time) ([]interfaces.FundingReversal, error) {
	query := url.Values{"from": {from.UTC().Format("2006-01-02")}, "to": {to.UTC().Format("2006-01-02")}}
	var rows []struct {
		Reference        string          `json:"reference"`
		FundingReference string          `json:"funding_reference"`
		Status           string          `json:"status"`
		Amount           json.RawMessage `json:"amount"`
		Currency         string          `json:"currency"`
		AccountReference string          `json:"account_reference"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts/refunds", query: query}, &rows); err != nil {
		return nil, err
	}
	reversals := make([]interfaces.FundingReversal, 0, len(rows))
	for _, row := range rows {
		currency := strings.ToUpper(firstNonEmptyString(row.Currency, "NGN"))
		amount, err := flutterwaveAmountMinor(row.Amount, currency)
		if err != nil {
			return nil, err
		}
		reversals = append(reversals, interfaces.FundingReversal{
			FundingReference: firstNonEmptyString(row.FundingReference, row.Reference), AccountRef: row.AccountReference,
			AmountMinor: amount, Currency: currency, Outcome: convertFlutterwaveTransferLikeStatus(row.Status),
		})
	}
	return reversals, nil
}

func (provider *FlutterwaveProvider) CloseWallet(ctx context.Context, accountRef string) error {
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodDelete, path: "/payout-subaccounts/" + url.PathEscape(accountRef)}, nil)
	return err
}

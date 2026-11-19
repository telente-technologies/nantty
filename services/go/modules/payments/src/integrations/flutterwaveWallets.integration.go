package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
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
	if !strings.EqualFold(currency, "NGN") {
		return nil, interfaces.ErrCurrencyNotSupported
	}
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
	if !strings.EqualFold(currency, "NGN") {
		return interfaces.ProviderBalance{}, interfaces.ErrCurrencyNotSupported
	}
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
	body := provider.transferBody(move.Reference, move.Currency, move.AmountMinor, firstNonEmptyString(move.Narration, "Nantty wallet transfer"))
	body["account_bank"], body["account_number"] = "flutterwave", destination
	if !move.FromPlatformBalance {
		body["debit_subaccount"] = move.FromAccountRef
	}
	return provider.postTransfer(ctx, body)
}

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
					TotalPages int `json:"total_pages"`
				} `json:"page_info"`
				Transfers []reversalRow `json:"transfers"`
			}
			if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/payout-subaccounts/refunds", query: query}, &result); err != nil {
				return nil, err
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
			if result.PageInfo.TotalPages <= page {
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

func (provider *FlutterwaveProvider) CloseWallet(ctx context.Context, accountRef string) error {
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodDelete, path: "/payout-subaccounts/" + url.PathEscape(accountRef)}, nil)
	return err
}

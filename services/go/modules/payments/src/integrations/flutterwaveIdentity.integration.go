package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"nantty/modules/payments/src/interfaces"
)

var (
	bvnPattern                  = regexp.MustCompile(`^[0-9]{11}$`)
	countryCodePattern          = regexp.MustCompile(`^[A-Z]{2}$`)
	flutterwaveResolveCountries = map[string]bool{"NG": true, "GH": true}
)

func (provider *FlutterwaveProvider) ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	return provider.ResolveBankAccountNameInCountry(ctx, "NG", bankCode, accountNumber)
}

func (provider *FlutterwaveProvider) ResolveBankAccountNameInCountry(ctx context.Context, country, bankCode, accountNumber string) (string, error) {
	country = strings.ToUpper(strings.TrimSpace(country))
	bankCode = strings.TrimSpace(bankCode)
	accountNumber = strings.TrimSpace(accountNumber)
	if !flutterwaveResolveCountries[country] {
		return "", interfaces.ErrCurrencyNotSupported
	}
	if bankCode == "" || accountNumber == "" {
		return "", errors.New("flutterwave: account resolution needs a bank code and account number")
	}
	body := map[string]any{"account_number": accountNumber, "account_bank": bankCode}
	if country != "NG" {
		body["country"] = country
	}
	var response struct {
		AccountName string `json:"account_name"`
	}
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/accounts/resolve", body: body, retrySafe: true}, &response)
	if isDefinitiveFlutterwaveRejection(err) {
		return "", interfaces.ErrBankAccountNotFound
	}
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(response.AccountName) == "" {
		return "", interfaces.ErrBankAccountNotFound
	}
	return strings.TrimSpace(response.AccountName), nil
}

func (provider *FlutterwaveProvider) ListBanks(ctx context.Context, countryCode string) ([]interfaces.Bank, error) {
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	if !countryCodePattern.MatchString(countryCode) {
		return nil, interfaces.ErrCurrencyNotSupported
	}
	var rows []struct {
		ID   int64  `json:"id"`
		Code string `json:"code"`
		Name string `json:"name"`
	}
	path := "/banks/" + url.PathEscape(strings.ToUpper(countryCode))
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: path, query: url.Values{"include_provider_type": {"1"}}}, &rows); err != nil {
		return nil, err
	}
	if rows == nil {
		return nil, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave: bank catalog response omitted the data array"))
	}
	banks := make([]interfaces.Bank, 0, len(rows))
	for _, row := range rows {
		if row.Code != "" {
			banks = append(banks, interfaces.Bank{Code: row.Code, Name: row.Name, CountryCode: strings.ToUpper(countryCode), ProviderID: row.ID})
		}
	}
	return banks, nil
}

func (provider *FlutterwaveProvider) ListBankBranches(ctx context.Context, countryCode, bankCode string) ([]interfaces.BankBranch, error) {
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	bankCode = strings.TrimSpace(bankCode)
	if !countryCodePattern.MatchString(countryCode) || bankCode == "" {
		return nil, interfaces.ErrCurrencyNotSupported
	}
	banks, err := provider.ListBanks(ctx, countryCode)
	if err != nil {
		return nil, err
	}
	bank, found := findBankByCode(banks, bankCode)
	if !found || bank.ProviderID <= 0 {
		return nil, interfaces.ErrBankAccountNotFound
	}
	var rows []struct {
		Code string `json:"branch_code"`
		Name string `json:"branch_name"`
	}
	path := "/banks/" + strconv.FormatInt(bank.ProviderID, 10) + "/branches"
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: path}, &rows); err != nil {
		return nil, err
	}
	if rows == nil {
		return nil, errors.New("flutterwave: bank branches response omitted the data array")
	}
	branches := make([]interfaces.BankBranch, 0, len(rows))
	for _, row := range rows {
		if strings.TrimSpace(row.Code) != "" {
			branches = append(branches, interfaces.BankBranch{Code: strings.TrimSpace(row.Code), Name: strings.TrimSpace(row.Name)})
		}
	}
	return branches, nil
}

func findBankByCode(banks []interfaces.Bank, code string) (interfaces.Bank, bool) {
	for _, bank := range banks {
		if bank.Code == code {
			return bank, true
		}
	}
	return interfaces.Bank{}, false
}

func (provider *FlutterwaveProvider) RequestPayoutIdentityCheck(context.Context, interfaces.PayoutIdentityRequest) (string, error) {
	return "", interfaces.ErrCapabilityNotSupported
}

func (provider *FlutterwaveProvider) StartBvnConsent(ctx context.Context, request interfaces.BvnConsentRequest) (interfaces.ConsentSession, error) {
	if !bvnPattern.MatchString(request.Bvn) || request.FirstName == "" || request.LastName == "" {
		return interfaces.ConsentSession{}, errors.New("flutterwave: a BVN consent needs an 11-digit BVN and the first and last name")
	}
	body := map[string]any{"bvn": request.Bvn, "firstname": request.FirstName, "lastname": request.LastName, "redirect_url": request.RedirectUrl}
	var response struct {
		Url       *string `json:"url"`
		Reference string  `json:"reference"`
	}
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPost, path: "/bvn/verifications", body: body}, &response); err != nil {
		return interfaces.ConsentSession{}, err
	}
	if response.Reference == "" {
		return interfaces.ConsentSession{}, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave returned no consent reference"))
	}
	session := interfaces.ConsentSession{Reference: response.Reference}
	if response.Url != nil {
		session.ConsentUrl = *response.Url
	}
	return session, nil
}

type flutterwaveFlag bool

func (flag *flutterwaveFlag) UnmarshalJSON(raw []byte) error {
	text := strings.ToLower(strings.Trim(string(raw), `"`))
	*flag = flutterwaveFlag(text == "true" || text == "yes" || text == "1")
	return nil
}

func (provider *FlutterwaveProvider) ReadBvnResult(ctx context.Context, reference string) (interfaces.BvnIdentity, error) {
	var response struct {
		Status     string          `json:"status"`
		FirstName  string          `json:"first_name"`
		MiddleName string          `json:"middle_name"`
		LastName   string          `json:"last_name"`
		Dob        string          `json:"date_of_birth"`
		Phone      string          `json:"phone_number"`
		BvnData    json.RawMessage `json:"bvn_data"`
	}
	path := "/bvn/verifications/" + url.PathEscape(reference)
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: path}, &response); err != nil {
		return interfaces.BvnIdentity{}, err
	}
	var data struct {
		FirstName   string          `json:"firstName"`
		MiddleName  string          `json:"middleName"`
		Surname     string          `json:"surname"`
		DateOfBirth string          `json:"dateOfBirth"`
		Phone       string          `json:"phoneNumber1"`
		Watchlisted flutterwaveFlag `json:"watchlisted"`
	}
	if len(response.BvnData) > 0 && string(response.BvnData) != "null" {
		if err := json.Unmarshal(response.BvnData, &data); err != nil {
			return interfaces.BvnIdentity{}, errors.Join(interfaces.ErrProviderUnavailable, err)
		}
	}
	return interfaces.BvnIdentity{
		Reference: reference, Status: strings.ToUpper(response.Status),
		FirstName: firstNonEmptyString(data.FirstName, response.FirstName), MiddleName: firstNonEmptyString(data.MiddleName, response.MiddleName),
		LastName: firstNonEmptyString(data.Surname, response.LastName), DateOfBirth: firstNonEmptyString(data.DateOfBirth, response.Dob),
		Phone: firstNonEmptyString(data.Phone, response.Phone), Watchlisted: bool(data.Watchlisted),
	}, nil
}

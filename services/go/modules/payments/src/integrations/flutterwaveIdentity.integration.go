package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"nantty/modules/payments/src/interfaces"
)

var (
	bvnPattern                  = regexp.MustCompile(`^[0-9]{11}$`)
	flutterwaveResolveCountries = map[string]bool{"NG": true, "GH": true}
)

func (provider *FlutterwaveProvider) ResolveBankAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	return provider.ResolveBankAccountNameInCountry(ctx, "NG", bankCode, accountNumber)
}

func (provider *FlutterwaveProvider) ResolveBankAccountNameInCountry(ctx context.Context, country, bankCode, accountNumber string) (string, error) {
	if !flutterwaveResolveCountries[country] {
		return "", interfaces.ErrCurrencyNotSupported
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
	if len(countryCode) != 2 {
		return nil, interfaces.ErrCurrencyNotSupported
	}
	var rows []struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}
	path := "/banks/" + url.PathEscape(strings.ToUpper(countryCode))
	if _, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: path, query: url.Values{"include_provider_type": {"1"}}}, &rows); err != nil {
		return nil, err
	}
	banks := make([]interfaces.Bank, 0, len(rows))
	for _, row := range rows {
		if row.Code != "" {
			banks = append(banks, interfaces.Bank{Code: row.Code, Name: row.Name, CountryCode: strings.ToUpper(countryCode)})
		}
	}
	return banks, nil
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

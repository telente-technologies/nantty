package integrations

import (
	"context"
	"errors"
	"net/http"
	"net/url"

	"zudomart/modules/payments/src/interfaces"
)

func (provider *PaystackProvider) RequestPayoutIdentityCheck(ctx context.Context, request interfaces.PayoutIdentityRequest) (string, error) {
	customerCode := request.SubjectId
	if customerCode == "" {
		var created struct {
			CustomerCode string `json:"customer_code"`
		}
		body := map[string]any{"email": request.Email, "first_name": request.FirstName, "last_name": request.LastName}
		if err := provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/customer", body: body, retrySafe: true}, &created); err != nil {
			return "", err
		}
		if created.CustomerCode == "" {
			return "", errors.New("paystack returned a customer without a code")
		}
		customerCode = created.CustomerCode
	}
	body := map[string]any{
		"country": request.Country, "type": "bank_account", "account_number": request.AccountNumber, "bvn": request.Bvn,
		"bank_code": request.BankCode, "first_name": request.FirstName, "last_name": request.LastName,
	}
	return customerCode, provider.http.send(ctx, paystackRequest{method: http.MethodPost, path: "/customer/" + url.PathEscape(customerCode) + "/identification", body: body, retrySafe: true}, nil)
}

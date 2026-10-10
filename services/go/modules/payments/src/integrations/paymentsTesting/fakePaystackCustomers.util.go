package paymentstesting

import "net/http"

func (fake *FakePaystack) routeCustomers(request fakeRequest) (int, any, any) {
	segments := request.segments
	switch {
	case request.method == http.MethodPost && len(segments) == 1:
		email := text(request.body["email"])
		if email == "" {
			return http.StatusBadRequest, "Email is required", nil
		}
		code, found := fake.Customers[email]
		if !found {
			code = fake.newId("CUS")
			fake.Customers[email] = code
		}
		return http.StatusOK, map[string]any{"customer_code": code, "email": email}, nil
	case request.method == http.MethodPost && len(segments) == 3 && segments[2] == "identification":
		known := false
		for _, code := range fake.Customers {
			known = known || code == segments[1]
		}
		if !known {
			return http.StatusNotFound, "Customer not found", nil
		}
		fake.Identifications[segments[1]] = request.body
		return http.StatusAccepted, nil, nil
	}
	return http.StatusNotFound, "unknown path " + request.path, nil
}

func (harness *MoneyHarness) DeliverBankValidationResult(userId string, succeeded bool) {
	harness.T.Helper()
	customer, err := harness.Payments.Application.Gateway.FindProviderCustomerId(harness.T.Context(), userId)
	if err != nil || customer == "" {
		harness.T.Fatalf("no Paystack customer for %s: %v", userId, err)
	}
	identification := harness.Paystack.Identifications[customer]
	if identification == nil {
		harness.T.Fatalf("no identification was requested for %s", userId)
	}
	data := map[string]any{"customer_code": customer, "identification": map[string]any{"country": "NG", "type": "bank_account", "bank_code": identification["bank_code"], "account_number": "012****345"}}
	event := "customeridentification.success"
	if !succeeded {
		event, data["reason"] = "customeridentification.failed", "Account number or BVN is incorrect"
	}
	harness.DeliverPaystackEvent(event, data)
}

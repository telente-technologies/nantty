package paymentstesting

import (
	"net/http"
	"strings"
)

func (fake *FakeBachs) route(request fakeRequest) (int, any) {
	segments := request.segments
	if len(segments) < 2 {
		return http.StatusNotFound, fakeError("NOT_FOUND", "unknown path")
	}
	resource := segments[1]
	switch {
	case resource == "accounts":
		return fake.routeAccounts(request)
	case resource == "balance_settings" && request.method == http.MethodPost:
		fake.ManualSchedules[request.accountId] = strings.Contains(stringifyBody(request.body), `"interval":"manual"`)
		return http.StatusOK, request.body
	case resource == "virtual-accounts":
		return http.StatusCreated, map[string]any{"id": "va_" + request.accountId, "currency": "NGN", "account_number": "9902847361", "bank_name": "Example Bank", "status": "active"}
	case resource == "checkout-sessions" && request.method == http.MethodPost:
		return fake.createCheckout(request)
	case resource == "checkout-sessions" && len(segments) == 3:
		return fake.readCheckout(request, segments[2])
	case resource == "refunds" && request.method == http.MethodPost:
		return fake.createRefund(request)
	case resource == "transfers" && request.method == http.MethodPost:
		return fake.createTransfer(request)
	case resource == "transfers" && len(segments) == 3:
		if transfer, found := fake.Transfers[segments[2]]; found {
			return http.StatusOK, transfer
		}
		return http.StatusNotFound, fakeError("NOT_FOUND", "no transfer")
	case resource == "payouts":
		return fake.routePayouts(request)
	case resource == "balances":
		return fake.readBalances(request)
	case resource == "disputes" && request.method == http.MethodGet:
		return http.StatusOK, map[string]any{"total": len(fake.Disputes[request.accountId]), "items": fake.disputesWithStatus(request.accountId, request.query["status"])}
	case resource == "disputes":
		return http.StatusOK, map[string]any{"dispute_id": segments[2], "status": "under_review"}
	case resource == "misc":
		if strings.HasPrefix(stringifyBody(request.body["account_number"]), "000") {
			return http.StatusOK, map[string]any{"resolved": false, "account_name": nil}
		}
		return http.StatusOK, map[string]any{"resolved": true, "account_name": "TEMITOPE ADEYEMI", "account_number": request.body["account_number"]}
	case resource == "reference":
		return http.StatusOK, map[string]any{"country": "NG", "banks": []map[string]any{{"code": "058", "name": "Guaranty Trust Bank"}, {"code": "057", "name": "Zenith Bank"}}}
	case resource == "products" && request.method == http.MethodPost:
		return http.StatusCreated, map[string]any{"id": fake.newId("prod")}
	case resource == "subscriptions" && request.method == http.MethodDelete:
		return http.StatusOK, map[string]any{"id": segments[2], "status": "canceled"}
	}
	return http.StatusNotFound, fakeError("NOT_FOUND", "unknown path "+request.path)
}

func stringifyBody(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case map[string]any:
		parts := []string{}
		for key, nested := range typed {
			parts = append(parts, `"`+key+`":`+quoteIfString(nested))
		}
		return "{" + strings.Join(parts, ",") + "}"
	}
	return ""
}

func quoteIfString(value any) string {
	if text, isString := value.(string); isString {
		return `"` + text + `"`
	}
	return stringifyBody(value)
}

func (fake *FakeBachs) routeAccounts(request fakeRequest) (int, any) {
	segments := request.segments
	switch {
	case len(segments) == 2 && request.method == http.MethodPost:
		id := fake.newId("acct")
		capabilities := map[string]string{"payouts": "pending", "transfers": "pending"}
		if configuration, ok := request.body["configuration"].(map[string]any); ok && configuration["merchant"] != nil {
			capabilities["ngn_card_collection"], capabilities["bank_transfer"] = "pending", "pending"
		}
		fake.Accounts[id] = capabilities
		fake.Balances[id] = map[string]int64{}
		return http.StatusCreated, fake.accountBody(id)
	case len(segments) == 3 && request.method == http.MethodGet:
		if _, found := fake.Accounts[segments[2]]; !found {
			return http.StatusNotFound, fakeError("NOT_FOUND", "no account")
		}
		return http.StatusOK, fake.accountBody(segments[2])
	case len(segments) == 3:
		return http.StatusOK, fake.accountBody(segments[2])
	case len(segments) == 4 && segments[3] == "account-links":
		return http.StatusCreated, map[string]any{"url": "https://connect.bachs.test/setup/" + segments[2], "expires_at": "2030-01-01T00:00:00Z"}
	case len(segments) == 4 && segments[3] == "persons":
		return http.StatusCreated, map[string]any{"id": fake.newId("per")}
	}
	return http.StatusNotFound, fakeError("NOT_FOUND", "unknown account path")
}

func (fake *FakeBachs) accountBody(id string) map[string]any {
	capabilities := map[string]any{}
	due := []string{}
	for name, status := range fake.Accounts[id] {
		capabilities[name] = map[string]any{"status": status, "requested": true}
		if status != "active" {
			due = append(due, "persons")
		}
	}
	return map[string]any{"id": id, "capabilities": capabilities, "requirements": map[string]any{"currently_due": due[:min(len(due), 1)], "past_due": []string{}}}
}

func (fake *FakeBachs) ActivateAllCapabilities(accountId string) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for name := range fake.Accounts[accountId] {
		fake.Accounts[accountId][name] = "active"
	}
}

func (fake *FakeBachs) readBalances(request fakeRequest) (int, any) {
	accountId := request.accountId
	if accountId == "" {
		accountId = FakeBachsPlatformId
	}
	balances := []map[string]any{}
	for currency, amount := range fake.Balances[accountId] {
		balances = append(balances, map[string]any{"currency": currency, "available_balance": signedDecimal(amount, currency), "pending_balance": "0.00"})
	}
	return http.StatusOK, map[string]any{"account_id": accountId, "balances": balances}
}

func signedDecimal(amount int64, currency string) string {
	if amount < 0 {
		return "-" + decimal(-amount, currency)
	}
	return decimal(amount, currency)
}

func (fake *FakeBachs) disputesWithStatus(accountId, status string) []map[string]any {
	matching := []map[string]any{}
	for _, dispute := range fake.Disputes[accountId] {
		if status == "" || dispute["status"] == status {
			matching = append(matching, dispute)
		}
	}
	return matching
}

func (fake *FakeBachs) OpenDispute(accountId string, dispute map[string]any) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.Disputes[accountId] = append(fake.Disputes[accountId], dispute)
}

func (fake *FakeBachs) DebitLostDispute(accountId, currency string, amountMinor int64) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	fake.adjust(accountId, currency, -amountMinor)
}

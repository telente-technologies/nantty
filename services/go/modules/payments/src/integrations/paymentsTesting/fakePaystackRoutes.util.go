package paymentstesting

import (
	"net/http"
	"strings"
)

func (fake *FakePaystack) route(request fakeRequest) (int, any, any) {
	segments := request.segments
	resource := segments[0]
	switch {
	case resource == "transaction" && len(segments) > 1 && segments[1] == "initialize":
		return fake.initializeTransaction(request)
	case resource == "transaction" && len(segments) == 3 && segments[1] == "verify":
		if transaction, found := fake.Transactions[segments[2]]; found {
			return http.StatusOK, transactionBody(transaction), nil
		}
		return http.StatusNotFound, "Transaction reference not found", nil
	case resource == "transaction" && len(segments) > 1 && segments[1] == "charge_authorization":
		return fake.chargeAuthorization(request)
	case resource == "refund":
		return fake.createRefund(request)
	case resource == "bank" && len(segments) == 2 && segments[1] == "resolve":
		return fake.resolveAccount(request)
	case resource == "bank":
		return http.StatusOK, []map[string]any{{"code": "058", "name": "Guaranty Trust Bank", "active": true}, {"code": "057", "name": "Zenith Bank", "active": true}}, map[string]any{"page": 1, "pageCount": 1}
	case resource == "transferrecipient" && request.method == http.MethodGet:
		return http.StatusOK, valuesOf(fake.Recipients), map[string]any{"page": 1, "pageCount": 1}
	case resource == "transferrecipient":
		fake.RecipientCreations++
		code := fake.newId("RCP")
		fake.Recipients[code] = map[string]any{"recipient_code": code, "metadata": request.body["metadata"], "details": map[string]any{"account_number": request.body["account_number"], "bank_code": request.body["bank_code"]}}
		return http.StatusCreated, fake.Recipients[code], nil
	case resource == "subaccount" && request.method == http.MethodGet:
		return http.StatusOK, valuesOf(fake.Subaccounts), map[string]any{"page": 1, "pageCount": 1}
	case resource == "subaccount" && request.method == http.MethodPost:
		fake.SubaccountCreations++
		code := fake.newId("ACCT")
		fake.Subaccounts[code] = map[string]any{"subaccount_code": code, "account_number": request.body["account_number"], "metadata": request.body["metadata"], "settlement_schedule": "AUTO"}
		return http.StatusCreated, fake.Subaccounts[code], nil
	case resource == "subaccount" && request.method == http.MethodPut && len(segments) == 2:
		if subaccount, found := fake.Subaccounts[segments[1]]; found {
			subaccount["settlement_schedule"] = strings.ToUpper(text(request.body["settlement_schedule"]))
			return http.StatusOK, subaccount, nil
		}
		return http.StatusNotFound, "Subaccount not found", nil
	case resource == "transfer" && request.method == http.MethodPost:
		return fake.createTransfer(request)
	case resource == "transfer" && len(segments) == 3 && segments[1] == "verify":
		if transfer, found := fake.Transfers[segments[2]]; found {
			return http.StatusOK, transferBody(transfer), nil
		}
		return http.StatusNotFound, "Transfer not found", nil
	case resource == "balance":
		return http.StatusOK, []map[string]any{{"currency": "NGN", "balance": fake.PlatformBalance["NGN"]}}, nil
	case resource == "settlement" && len(segments) == 3:
		return fake.settlementTransactions(segments[1])
	case resource == "settlement":
		return fake.settlements(request.query["subaccount"])
	case resource == "plan":
		return http.StatusCreated, map[string]any{"plan_code": fake.newId("PLN")}, nil
	case resource == "subscription" && len(segments) == 2 && segments[1] == "disable":
		if subscription, found := fake.Subscriptions[text(request.body["code"])]; found && subscription["email_token"] == text(request.body["token"]) {
			subscription["status"] = "non-renewing"
			return http.StatusOK, nil, nil
		}
		return http.StatusBadRequest, "Subscription not found", nil
	case resource == "subscription":
		code := fake.newId("SUB")
		fake.Subscriptions[code] = map[string]any{"subscription_code": code, "email_token": "tok_" + code, "status": "active", "customer": request.body["customer"], "plan": request.body["plan"], "next_payment_date": request.body["start_date"]}
		return http.StatusOK, fake.Subscriptions[code], nil
	case resource == "dispute" && request.method == http.MethodGet:
		return http.StatusOK, fake.Disputes, map[string]any{"page": 1, "pageCount": 1}
	case resource == "dispute":
		return http.StatusOK, map[string]any{"id": segments[1]}, nil
	}
	return http.StatusNotFound, "unknown path " + request.path, nil
}

func valuesOf(items map[string]map[string]any) []map[string]any {
	values := make([]map[string]any, 0, len(items))
	for _, item := range items {
		values = append(values, item)
	}
	return values
}

func (fake *FakePaystack) initializeTransaction(request fakeRequest) (int, any, any) {
	reference := text(request.body["reference"])
	if existing, found := fake.Transactions[reference]; found {
		if existing.Status != "pending" {
			return http.StatusBadRequest, "Duplicate Transaction Reference", nil
		}
		return http.StatusOK, map[string]any{"authorization_url": "https://checkout.paystack.test/" + reference, "access_code": "ac_" + reference, "reference": reference}, nil
	}
	if text(request.body["email"]) == "" || number(request.body["amount"]) <= 0 {
		return http.StatusBadRequest, "email and amount are required", nil
	}
	fake.nextId++
	metadata, _ := request.body["metadata"].(map[string]any)
	fake.Transactions[reference] = &FakeTransaction{
		Id: fake.nextId, Reference: reference, AmountMinor: number(request.body["amount"]), Currency: text(request.body["currency"]), Email: text(request.body["email"]),
		Subaccount: text(request.body["subaccount"]), Bearer: text(request.body["bearer"]), PlanCode: text(request.body["plan"]), Status: "pending", Metadata: metadata,
	}
	return http.StatusOK, map[string]any{"authorization_url": "https://checkout.paystack.test/" + reference, "access_code": "ac_" + reference, "reference": reference}, nil
}

func (fake *FakePaystack) chargeAuthorization(request fakeRequest) (int, any, any) {
	code := text(request.body["authorization_code"])
	reference := text(request.body["reference"])
	if _, exists := fake.Transactions[reference]; exists {
		return http.StatusBadRequest, "Duplicate Transaction Reference", nil
	}
	fake.nextId++
	transaction := &FakeTransaction{
		Id: fake.nextId, Reference: reference, AmountMinor: number(request.body["amount"]), Currency: text(request.body["currency"]), Email: text(request.body["email"]),
		Subaccount: text(request.body["subaccount"]), Channel: "card", AuthorizationCode: code, Status: "success", CustomerCode: "CUS_" + strings.ReplaceAll(text(request.body["email"]), "@", "_"),
	}
	fake.Transactions[reference] = transaction
	switch {
	case strings.Contains(code, "PAUSE"):
		transaction.Status = "pending"
		return http.StatusOK, map[string]any{"reference": reference, "status": "pending", "paused": true, "authorization_url": "https://checkout.paystack.test/2fa/" + reference}, nil
	case strings.Contains(code, "DECLINE"):
		transaction.Status = "failed"
	default:
		fake.creditForTransaction(transaction)
	}
	return http.StatusOK, transactionBody(transaction), nil
}

func transactionBody(transaction *FakeTransaction) map[string]any {
	body := map[string]any{
		"id": transaction.Id, "reference": transaction.Reference, "status": transaction.Status, "amount": transaction.AmountMinor, "currency": transaction.Currency,
		"fees": transaction.FeeMinor, "channel": transaction.Channel, "gateway_response": "Approved", "plan": transaction.PlanCode,
		"customer": map[string]any{"customer_code": transaction.CustomerCode, "email": transaction.Email}, "subaccount": map[string]any{"subaccount_code": transaction.Subaccount},
	}
	if transaction.Status == "pending" {
		body["status"] = "abandoned"
		body["gateway_response"] = "The transaction was not completed"
	}
	if transaction.AuthorizationCode != "" {
		body["authorization"] = map[string]any{
			"authorization_code": transaction.AuthorizationCode, "last4": "4081", "exp_month": "12", "exp_year": "2030", "card_type": "visa ", "brand": "visa",
			"channel": "card", "reusable": true, "signature": "SIG_" + transaction.Email,
		}
	}
	return body
}

func (fake *FakePaystack) createRefund(request fakeRequest) (int, any, any) {
	transaction := fake.Transactions[text(request.body["transaction"])]
	if transaction == nil || transaction.Status != "success" {
		return http.StatusBadRequest, "Transaction not found or not refundable", nil
	}
	amount := number(request.body["amount"])
	if amount == 0 {
		amount = transaction.AmountMinor
	}
	status := "pending"
	if fake.RefundsNeedAttention || transaction.Channel == "bank_transfer" {
		status = "needs-attention"
	}
	fake.PlatformBalance[transaction.Currency] -= amount
	refund := map[string]any{"id": fake.nextIdNumber(), "status": status, "amount": amount, "transaction_reference": transaction.Reference}
	fake.Refunds = append(fake.Refunds, refund)
	return http.StatusOK, refund, nil
}

func (fake *FakePaystack) nextIdNumber() int64 {
	fake.nextId++
	return fake.nextId
}

func (fake *FakePaystack) resolveAccount(request fakeRequest) (int, any, any) {
	accountNumber := request.query["account_number"]
	switch {
	case strings.HasPrefix(accountNumber, "000"):
		return http.StatusUnprocessableEntity, "Could not resolve account name", nil
	case strings.HasPrefix(accountNumber, "111"):
		return http.StatusOK, map[string]any{"account_name": "SOMEONE ELSE", "account_number": accountNumber}, nil
	}
	return http.StatusOK, map[string]any{"account_name": "TEMITOPE ADEYEMI", "account_number": accountNumber}, nil
}

func (fake *FakePaystack) createTransfer(request fakeRequest) (int, any, any) {
	reference := strings.ToLower(text(request.body["reference"]))
	if existing, found := fake.Transfers[reference]; found {
		return http.StatusOK, transferBody(existing), nil
	}
	amount := number(request.body["amount"])
	fee := int64(1000)
	if fake.PlatformBalance["NGN"] < amount+fee {
		return http.StatusBadRequest, "Your balance is not enough to fulfil this request", nil
	}
	fake.PlatformBalance["NGN"] -= amount + fee
	transfer := &FakeTransfer{Reference: reference, Recipient: text(request.body["recipient"]), Status: "pending", Code: fake.newId("TRF"), AmountMinor: amount, FeeMinor: fee}
	fake.Transfers[reference] = transfer
	return http.StatusOK, transferBody(transfer), nil
}

func transferBody(transfer *FakeTransfer) map[string]any {
	return map[string]any{"reference": transfer.Reference, "transfer_code": transfer.Code, "status": transfer.Status, "amount": transfer.AmountMinor, "fee": transfer.FeeMinor}
}

func (fake *FakePaystack) settlements(subaccount string) (int, any, any) {
	if balance := fake.SubaccountBalances[subaccount]; subaccount != "" && balance > 0 {
		return http.StatusOK, []map[string]any{{"id": settlementIdFor(subaccount), "status": "success", "currency": "NGN", "total_amount": balance}}, map[string]any{"page": 1, "pageCount": 1}
	}
	return http.StatusOK, []map[string]any{}, map[string]any{"page": 1, "pageCount": 1}
}

func (fake *FakePaystack) settlementTransactions(settlementId string) (int, any, any) {
	subaccount := "ACCT_" + strings.TrimPrefix(settlementId, "9")
	items := []map[string]any{}
	for _, transaction := range fake.Transactions {
		if transaction.Subaccount == subaccount && transaction.Status == "success" {
			items = append(items, map[string]any{"reference": transaction.Reference})
		}
	}
	return http.StatusOK, items, map[string]any{"page": 1, "pageCount": 1}
}

func settlementIdFor(subaccount string) int64 {
	digits := strings.TrimPrefix(subaccount, "ACCT_")
	var value int64 = 9
	for _, digit := range digits {
		value = value*10 + int64(digit-'0')
	}
	return value
}

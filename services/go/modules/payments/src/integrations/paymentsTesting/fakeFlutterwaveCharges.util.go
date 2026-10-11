package paymentstesting

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/payments/src/integrations"
)

func (fake *FakeFlutterwave) routeCharges(request fakeFlwRequest) (int, any, any) {
	segments := request.segments
	switch {
	case request.method == http.MethodPost && segments[0] == "payments":
		return fake.createStandardCheckout(request.body)
	case request.method == http.MethodGet && segments[0] == "transactions" && len(segments) == 2 && segments[1] == "verify_by_reference":
		for _, transaction := range fake.Transactions {
			if transaction.TxRef == request.query["tx_ref"] {
				return http.StatusOK, fake.transactionJson(transaction), nil
			}
		}
		return http.StatusNotFound, "No transaction was found for this id", nil
	case request.method == http.MethodGet && segments[0] == "transactions" && len(segments) == 3 && segments[2] == "verify":
		id, _ := strconv.ParseInt(segments[1], 10, 64)
		if transaction := fake.Transactions[id]; transaction != nil {
			return http.StatusOK, fake.transactionJson(transaction), nil
		}
		return http.StatusNotFound, "No transaction was found for this id", nil
	case request.method == http.MethodPost && segments[0] == "transactions" && len(segments) == 3 && segments[2] == "refund":
		id, _ := strconv.ParseInt(segments[1], 10, 64)
		return fake.refundTransaction(fake.Transactions[id], request.body)
	case request.method == http.MethodPost && segments[0] == "tokenized-charges":
		return fake.chargeToken(request.body)
	case request.method == http.MethodGet && segments[0] == "refunds" && len(segments) == 1:
		return http.StatusOK, fake.Refunds, nil
	case request.method == http.MethodGet && segments[0] == "refunds" && len(segments) == 2:
		for _, refund := range fake.Refunds {
			if fmt.Sprint(refund["id"]) == segments[1] {
				return http.StatusOK, refund, nil
			}
		}
		return http.StatusNotFound, "Refund not found", nil
	}
	return http.StatusNotFound, "Route not found", nil
}

func (fake *FakeFlutterwave) createStandardCheckout(body map[string]any) (int, any, any) {
	reference, currency := text(body["tx_ref"]), text(body["currency"])
	customer, _ := body["customer"].(map[string]any)
	email := strings.ToLower(text(customer["email"]))
	amount, valid := fakeMinor(body["amount"], currency)
	if reference == "" || email == "" || !valid {
		return http.StatusBadRequest, "tx_ref, amount, currency and customer.email are required", nil
	}
	expected := integrations.FlutterwavePayloadHash(text(body["amount"]), currency, text(customer["email"]), reference, FakeFlutterwaveSecretKey)
	if fake.RejectPayloadHash || text(body["payload_hash"]) != expected {
		return http.StatusBadRequest, "Invalid payload_hash", nil
	}
	for _, existing := range fake.Transactions {
		if existing.TxRef == reference {
			return http.StatusOK, map[string]any{"link": fake.Link(reference)}, nil
		}
	}
	id := fake.newId()
	fake.Transactions[id] = &FakeFlwTransaction{
		Id: id, TxRef: reference, FlwRef: fmt.Sprintf("FLW-MOCK-%d", id), Email: email, Name: text(customer["name"]), AmountMinor: amount, Currency: currency,
		Status: "pending", PaymentType: "card", CreatedAt: time.Now().UTC(),
	}
	return http.StatusOK, map[string]any{"link": fake.Link(reference)}, nil
}

func (fake *FakeFlutterwave) transactionJson(transaction *FakeFlwTransaction) map[string]any {
	data := map[string]any{
		"id": transaction.Id, "tx_ref": transaction.TxRef, "flw_ref": transaction.FlwRef, "amount": fakeMajor(transaction.AmountMinor, transaction.Currency),
		"charged_amount": fakeMajor(transaction.AmountMinor, transaction.Currency), "app_fee": fakeMajor(transaction.AppFeeMinor, transaction.Currency),
		"merchant_fee": 0, "currency": transaction.Currency, "status": transaction.Status, "payment_type": transaction.PaymentType,
		"processor_response": "Approved", "created_at": transaction.CreatedAt.Format(time.RFC3339),
		"customer": map[string]any{"id": transaction.Id + 1000, "email": transaction.Email, "name": transaction.Name},
	}
	if transaction.CardToken != "" {
		data["card"] = map[string]any{"first_6digits": "539983", "last_4digits": "8381", "issuer": "MASTERCARD GUARANTY TRUST BANK", "country": "NG", "type": "MASTERCARD", "token": transaction.CardToken, "expiry": "09/32"}
	}
	return data
}

func (fake *FakeFlutterwave) refundTransaction(transaction *FakeFlwTransaction, body map[string]any) (int, any, any) {
	if transaction == nil || transaction.Status != "successful" {
		return http.StatusBadRequest, "Transaction cannot be refunded", nil
	}
	amount := transaction.AmountMinor - transaction.RefundedMinor
	if value, present := body["amount"]; present {
		parsed, valid := fakeMinor(value, transaction.Currency)
		if !valid {
			return http.StatusBadRequest, "Invalid amount", nil
		}
		amount = parsed
	}
	if amount <= 0 || amount > transaction.AmountMinor-transaction.RefundedMinor {
		return http.StatusBadRequest, "Refund amount is more than the transaction amount", nil
	}
	transaction.RefundedMinor += amount
	fake.MainBalance[transaction.Currency] -= amount
	refund := map[string]any{
		"id": fake.newId(), "flw_ref": transaction.FlwRef, "amount_refunded": fakeMajor(amount, transaction.Currency), "status": "completed",
		"comments": text(body["comments"]), "transaction_id": transaction.Id, "destination": "payment_source", "created_at": time.Now().UTC().Format(time.RFC3339),
	}
	fake.Refunds = append(fake.Refunds, refund)
	return http.StatusOK, refund, nil
}

func (fake *FakeFlutterwave) chargeToken(body map[string]any) (int, any, any) {
	token, email, reference, currency := text(body["token"]), strings.ToLower(text(body["email"])), text(body["tx_ref"]), text(body["currency"])
	if owner, known := fake.Tokens[token]; !known || owner != email {
		return http.StatusBadRequest, "Wrong token or email passed", nil
	}
	amount, valid := fakeMinor(body["amount"], currency)
	if !valid || reference == "" || text(body["redirect_url"]) == "" {
		return http.StatusBadRequest, "amount, tx_ref and redirect_url are required", nil
	}
	for _, existing := range fake.Transactions {
		if existing.TxRef == reference {
			return http.StatusBadRequest, "Duplicate tx_ref", nil
		}
	}
	id := fake.newId()
	transaction := &FakeFlwTransaction{
		Id: id, TxRef: reference, FlwRef: fmt.Sprintf("FLW-TOKEN-%d", id), Email: email, AmountMinor: amount, Currency: currency, Status: "successful",
		PaymentType: "card", CardToken: token, AppFeeMinor: amount * 14 / 1000, CreatedAt: time.Now().UTC(),
	}
	fake.Transactions[id] = transaction
	return http.StatusOK, fake.transactionJson(transaction), nil
}

func (fake *FakeFlutterwave) CompleteCheckout(reference string, paidAmountOverride, appFeeMinor int64, paymentType string) *FakeFlwTransaction {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, transaction := range fake.Transactions {
		if transaction.TxRef != reference {
			continue
		}
		if paidAmountOverride > 0 {
			transaction.AmountMinor = paidAmountOverride
		}
		transaction.Status, transaction.AppFeeMinor, transaction.PaymentType = "successful", appFeeMinor, paymentType
		if paymentType == "card" {
			transaction.CardToken = fmt.Sprintf("flw-t1nf-%d-mock", transaction.Id)
			fake.Tokens[transaction.CardToken] = transaction.Email
		}
		return transaction
	}
	return nil
}

func (fake *FakeFlutterwave) ChargeWebhook(transaction *FakeFlwTransaction) ([]byte, http.Header) {
	fake.mutex.Lock()
	data := fake.transactionJson(transaction)
	fake.mutex.Unlock()
	return SignedFlutterwaveWebhook("charge.completed", data)
}

func (fake *FakeFlutterwave) TransactionByReference(reference string) *FakeFlwTransaction {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, transaction := range fake.Transactions {
		if transaction.TxRef == reference {
			return transaction
		}
	}
	return nil
}

func (fake *FakeFlutterwave) SettleAll(currency string) string {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	var gross, fees int64
	var references []map[string]any
	for _, transaction := range fake.Transactions {
		if transaction.Status != "successful" || transaction.Settled || transaction.Currency != currency {
			continue
		}
		transaction.Settled = true
		gross, fees = gross+transaction.AmountMinor, fees+transaction.AppFeeMinor
		references = append(references, map[string]any{"tx_ref": transaction.TxRef, "flw_ref": transaction.FlwRef, "amount": fakeMajor(transaction.AmountMinor, currency), "settlement_amount": fakeMajor(transaction.AmountMinor-transaction.AppFeeMinor, currency)})
	}
	if len(references) == 0 {
		return ""
	}
	fake.MainBalance[currency] += gross - fees
	id := fake.newId()
	now := time.Now().UTC().Format(time.RFC3339)
	fake.Settlements = append(fake.Settlements, map[string]any{
		"id": id, "status": "completed", "currency": currency, "gross_amount": fakeMajor(gross, currency), "app_fee": fakeMajor(fees, currency),
		"net_amount": fakeMajor(gross-fees, currency), "due_date": now, "settlement_date": now, "destination": "autowallet", "transactions": references,
	})
	return strconv.FormatInt(id, 10)
}

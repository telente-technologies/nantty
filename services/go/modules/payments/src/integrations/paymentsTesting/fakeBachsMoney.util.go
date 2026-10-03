package paymentstesting

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"zudomart/modules/payments/src/integrations"
)

func (fake *FakeBachs) createCheckout(request fakeRequest) (int, any) {
	pricing, _ := request.body["pricing"].(map[string]any)
	currency, _ := pricing["currency"].(string)
	reference, _ := request.body["reference"].(string)
	customer, _ := request.body["customer"].(map[string]any)
	email, _ := customer["email"].(string)
	if email == "" {
		return http.StatusBadRequest, fakeError("VALIDATION_ERROR", "customer email required")
	}
	if request.accountId != "" {
		if _, found := fake.Accounts[request.accountId]; !found {
			return http.StatusForbidden, fakeError("FORBIDDEN", "not your account")
		}
	}
	checkout := &FakeCheckout{
		Id: fake.newId("chk"), Reference: reference, AccountId: request.accountId, AmountMinor: minor(pricing["amount"], currency),
		PlatformFeeMinor: minor(request.body["platform_fee"], currency), Currency: currency, Status: "open", CustomerEmail: email,
	}
	if products, isSubscription := request.body["product_cart"]; isSubscription && products != nil {
		checkout.Currency = "USD"
	}
	fake.Checkouts[checkout.Reference] = checkout
	return http.StatusCreated, map[string]any{"checkout_id": checkout.Id, "checkout_url": "https://checkout.bachs.test/c/" + checkout.Id, "status": "open", "expires_at": "2030-01-01T00:00:00Z", "reference": reference}
}

func (fake *FakeBachs) readCheckout(request fakeRequest, checkoutId string) (int, any) {
	for _, checkout := range fake.Checkouts {
		if checkout.Id != checkoutId {
			continue
		}
		if checkout.AccountId != request.accountId {
			return http.StatusNotFound, fakeError("NOT_FOUND", "checkout belongs to another account")
		}
		body := map[string]any{"checkout_id": checkout.Id, "status": checkout.Status, "amount": decimal(checkout.AmountMinor, checkout.Currency), "currency": checkout.Currency, "reference": checkout.Reference, "platform_fee": nil}
		if checkout.PlatformFeeMinor > 0 {
			body["platform_fee"] = decimal(checkout.PlatformFeeMinor, checkout.Currency)
		}
		if checkout.Status == "completed" {
			body["payment_status"] = "succeeded"
			body["charge"] = map[string]any{"payment_id": "pay_" + checkout.ChargeId, "status": "succeeded", "amount": decimal(checkout.AmountMinor, checkout.Currency), "currency": checkout.Currency,
				"fees": map[string]any{"amount": decimal(checkout.ProcessingFee, checkout.Currency), "currency": checkout.Currency}}
		}
		return http.StatusOK, body
	}
	return http.StatusNotFound, fakeError("NOT_FOUND", "no checkout")
}

func (fake *FakeBachs) CompleteCheckout(reference string, paidAmountOverride, processingFee int64) *FakeCheckout {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	checkout := fake.Checkouts[reference]
	if checkout == nil {
		return nil
	}
	if paidAmountOverride > 0 {
		checkout.AmountMinor = paidAmountOverride
	}
	checkout.Status, checkout.ChargeId, checkout.ProcessingFee = "completed", fake.newId("ch"), processingFee
	fake.adjust(checkout.AccountId, checkout.Currency, checkout.AmountMinor-checkout.PlatformFeeMinor-processingFee)
	if checkout.AccountId != "" && checkout.PlatformFeeMinor > 0 {
		fake.adjust(FakeBachsPlatformId, checkout.Currency, checkout.PlatformFeeMinor)
	}
	return checkout
}

func (fake *FakeBachs) checkoutByCharge(chargeId string) *FakeCheckout {
	for _, checkout := range fake.Checkouts {
		if checkout.ChargeId != "" && (checkout.ChargeId == chargeId || "pay_"+checkout.ChargeId == chargeId) {
			return checkout
		}
	}
	return nil
}

func (fake *FakeBachs) createRefund(request fakeRequest) (int, any) {
	chargeId, _ := request.body["charge_id"].(string)
	checkout := fake.checkoutByCharge(chargeId)
	if checkout == nil || checkout.AccountId != request.accountId {
		return http.StatusNotFound, fakeError("NOT_FOUND", "no such charge for this account")
	}
	amount := checkout.AmountMinor
	if raw, partial := request.body["amount"]; partial {
		amount = minor(raw, checkout.Currency)
	}
	if fake.balance(checkout.AccountId, checkout.Currency) < amount {
		return http.StatusBadRequest, fakeError("BAD_REQUEST", "Insufficient balance to refund")
	}
	fake.adjust(checkout.AccountId, checkout.Currency, -amount)
	refund := map[string]any{"refund_id": fake.newId("rfnd"), "charge_id": chargeId, "reference": request.body["reference"], "status": "processing", "requested_amount": decimal(amount, checkout.Currency)}
	fake.Refunds = append(fake.Refunds, refund)
	return http.StatusOK, refund
}

func (fake *FakeBachs) createTransfer(request fakeRequest) (int, any) {
	currency, _ := request.body["currency"].(string)
	destination, _ := request.body["destination"].(string)
	amount := minor(request.body["amount"], currency)
	source := request.accountId
	if destination == "self" {
		destination = FakeBachsPlatformId
	} else if _, found := fake.Accounts[destination]; !found {
		return http.StatusNotFound, fakeError("NOT_FOUND", "destination is not your account")
	}
	if fake.balance(source, currency) < amount {
		return http.StatusBadRequest, fakeError("INSUFFICIENT_BALANCE", "source balance too low")
	}
	fake.adjust(source, currency, -amount)
	fake.adjust(destination, currency, amount)
	transfer := map[string]any{"id": fake.newId("tr"), "destination": destination, "amount": decimal(amount, currency), "currency": currency, "status": "paid", "kind": "manual", "transfer_group": request.body["transfer_group"]}
	fake.Transfers[transfer["id"].(string)] = transfer
	return http.StatusOK, transfer
}

func (fake *FakeBachs) routePayouts(request fakeRequest) (int, any) {
	segments := request.segments
	switch {
	case len(segments) == 3 && segments[2] == "destinations":
		return http.StatusCreated, map[string]any{"id": fake.newId("pd"), "status": "approved", "is_usable": true, "account_name": "TEMITOPE ADEYEMI"}
	case len(segments) == 2 && request.method == http.MethodPost:
		amount := minor(request.body["amount"], "NGN")
		if fake.balance(request.accountId, "NGN") < amount+fakeNairaPayoutFee {
			return http.StatusBadRequest, fakeError("INSUFFICIENT_BALANCE", "balance below amount plus fee")
		}
		fake.adjust(request.accountId, "NGN", -(amount + fakeNairaPayoutFee))
		reference, _ := request.body["reference"].(string)
		payout := &FakePayout{Id: fake.newId("pay"), AccountId: request.accountId, Reference: reference, Currency: "NGN", Status: "pending", AmountMinor: amount, FeeMinor: fakeNairaPayoutFee}
		fake.Payouts[payout.Id] = payout
		return http.StatusOK, payoutBody(payout)
	case len(segments) == 3 && request.method == http.MethodGet:
		if payout, found := fake.Payouts[segments[2]]; found && payout.AccountId == request.accountId {
			return http.StatusOK, payoutBody(payout)
		}
		return http.StatusNotFound, fakeError("NOT_FOUND", "no payout")
	}
	return http.StatusNotFound, fakeError("NOT_FOUND", "unknown payout path")
}

func payoutBody(payout *FakePayout) map[string]any {
	return map[string]any{"id": payout.Id, "status": payout.Status, "amount": decimal(payout.AmountMinor, payout.Currency), "currency": payout.Currency,
		"fee": decimal(payout.FeeMinor, payout.Currency), "total_debited": decimal(payout.AmountMinor+payout.FeeMinor, payout.Currency), "reference": payout.Reference}
}

func (fake *FakeBachs) SetPayoutStatus(reference, status string) *FakePayout {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, payout := range fake.Payouts {
		if payout.Reference == reference {
			payout.Status = status
			if status == "failed" {
				fake.adjust(payout.AccountId, payout.Currency, payout.AmountMinor+payout.FeeMinor)
			}
			return payout
		}
	}
	return nil
}

func SignedBachsWebhook(eventId, eventType, connectedAccountId string, data map[string]any, sentAt time.Time) ([]byte, http.Header) {
	envelope := map[string]any{"id": eventId, "type": eventType, "created_at": sentAt.UTC().Format(time.RFC3339), "organization_id": FakeBachsPlatformId, "data": data}
	if connectedAccountId != "" {
		envelope["organization_id"], envelope["account"] = connectedAccountId, connectedAccountId
	}
	body, _ := json.Marshal(envelope)
	timestamp := strconv.FormatInt(sentAt.Unix(), 10)
	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("X-Bachs-Timestamp", timestamp)
	signature := integrations.SignBachsWebhookPayload(FakeBachsSigningSecret, timestamp, body)
	headers.Set("X-Bachs-Signature", signature)
	headers.Set("X-Bachs-Signature-V2", "t="+timestamp+",v1="+signature)
	return body, headers
}

package paymentstesting

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func (fake *FakeFlutterwave) RefundAmountsMinor() []int64 {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	amounts := make([]int64, 0, len(fake.Refunds))
	for _, refund := range fake.Refunds {
		amount, _ := fakeMinor(refund["amount_refunded"], "NGN")
		amounts = append(amounts, amount)
	}
	return amounts
}

func (fake *FakeFlutterwave) refundStatus() string {
	if fake.RefundStatus != "" {
		return fake.RefundStatus
	}
	return "completed-mpgs"
}

func (fake *FakeFlutterwave) RefundWebhookForCharge(reference, status string) ([]byte, http.Header, bool) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, transaction := range fake.Transactions {
		if transaction.TxRef != reference {
			continue
		}
		for index := len(fake.Refunds) - 1; index >= 0; index-- {
			refund := fake.Refunds[index]
			if refund["transaction_id"] != transaction.Id {
				continue
			}
			refund["status"] = status
			body, _ := json.Marshal(map[string]any{"id": refund["id"], "AmountRefunded": refund["amount_refunded"], "status": status, "FlwRef": transaction.FlwRef, "TransactionId": transaction.Id})
			return body, fakeFlwHeaders(), true
		}
	}
	return nil, nil, false
}

func (fake *FakeFlutterwave) MarkRefundFailed(providerRefundId string) bool {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, refund := range fake.Refunds {
		if fmt.Sprint(refund["id"]) != providerRefundId || refund["status"] == "failed" {
			continue
		}
		refund["status"] = "failed"
		for _, transaction := range fake.Transactions {
			if transaction.Id == refund["transaction_id"] {
				amount, _ := fakeMinor(refund["amount_refunded"], transaction.Currency)
				transaction.RefundedMinor -= amount
				fake.MainBalance[transaction.Currency] += amount
			}
		}
		return true
	}
	return false
}

func (fake *FakeFlutterwave) FailCheckout(reference string) bool {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, transaction := range fake.Transactions {
		if transaction.TxRef == reference {
			transaction.Status = "failed"
			return true
		}
	}
	return false
}

func (fake *FakeFlutterwave) DeclineFutureChargesOn(reference string) bool {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, transaction := range fake.Transactions {
		if transaction.TxRef == reference && transaction.CardToken != "" {
			fake.DecliningTokens[transaction.CardToken] = true
			return true
		}
	}
	return false
}
